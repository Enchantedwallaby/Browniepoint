-- ====================================================================
-- BROWNIE POINT OPERATIONS SYSTEM - STOCK TRANSFERS MIGRATION
-- Migration Version: 20261003000001_stock_transfers_schema.sql
-- Description: Adds stock_transfers and stock_transfer_items tables, RLS,
--              and atomic PostgreSQL RPC functions for transfer dispatch
--              and receipt approval.
-- ====================================================================

-- 1. CREATE ENUM TYPE FOR TRANSFER STATUS
DO $$ BEGIN
  CREATE TYPE public.transfer_status AS ENUM (
    'PENDING',
    'IN_TRANSIT',
    'RECEIVED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

  
-- 2. CREATE STOCK_TRANSFERS TABLE
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number TEXT NOT NULL UNIQUE,
  source_branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  destination_branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  status public.transfer_status NOT NULL DEFAULT 'IN_TRANSIT',
  dispatched_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ,
  notes TEXT,
  discrepancy_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_branches_different CHECK (source_branch_id <> destination_branch_id)
);

-- 3. CREATE STOCK_TRANSFER_ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  batch_id UUID NOT NULL REFERENCES public.product_batches(id) ON DELETE RESTRICT,
  quantity_dispatched NUMERIC NOT NULL CHECK (quantity_dispatched > 0),
  quantity_received NUMERIC CHECK (quantity_received IS NULL OR quantity_received >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. INDEXES FOR FAST LOOKUPS
CREATE INDEX IF NOT EXISTS idx_transfers_source      ON public.stock_transfers(source_branch_id);
CREATE INDEX IF NOT EXISTS idx_transfers_destination ON public.stock_transfers(destination_branch_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status      ON public.stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfer_items_trf    ON public.stock_transfer_items(transfer_id);

-- Updated_at trigger
CREATE OR REPLACE TRIGGER trg_stock_transfers_updated_at
  BEFORE UPDATE ON public.stock_transfers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.stock_transfers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- Select transfers policy
CREATE POLICY "transfers_select"
  ON public.stock_transfers FOR SELECT TO authenticated
  USING (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    source_branch_id = public.get_auth_branch_id() OR
    destination_branch_id = public.get_auth_branch_id()
  );

-- Insert transfers policy
CREATE POLICY "transfers_insert"
  ON public.stock_transfers FOR INSERT TO authenticated
  WITH CHECK (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    source_branch_id = public.get_auth_branch_id()
  );

-- Update transfers policy
CREATE POLICY "transfers_update"
  ON public.stock_transfers FOR UPDATE TO authenticated
  USING (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    source_branch_id = public.get_auth_branch_id() OR
    destination_branch_id = public.get_auth_branch_id()
  );

-- Select transfer items policy
CREATE POLICY "transfer_items_select"
  ON public.stock_transfer_items FOR SELECT TO authenticated
  USING (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    EXISTS (
      SELECT 1 FROM public.stock_transfers st
      WHERE st.id = stock_transfer_items.transfer_id
        AND (st.source_branch_id = public.get_auth_branch_id() OR st.destination_branch_id = public.get_auth_branch_id())
    )
  );

-- Insert transfer items policy
CREATE POLICY "transfer_items_insert"
  ON public.stock_transfer_items FOR INSERT TO authenticated
  WITH CHECK (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    EXISTS (
      SELECT 1 FROM public.stock_transfers st
      WHERE st.id = stock_transfer_items.transfer_id
        AND st.source_branch_id = public.get_auth_branch_id()
    )
  );

-- 6. ATOMIC RPC FUNCTION TO DISPATCH STOCK TRANSFER
CREATE OR REPLACE FUNCTION public.create_stock_transfer(
  p_source_branch_id UUID,
  p_destination_branch_id UUID,
  p_notes TEXT,
  p_dispatched_by UUID,
  p_items JSONB
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_transfer_id UUID;
  v_trf_number TEXT;
  v_elem JSONB;
  v_variant_id UUID;
  v_variant_name TEXT;
  v_product_name TEXT;
  v_req_qty NUMERIC;
  v_rem_qty NUMERIC;
  v_alloc_qty NUMERIC;
  v_batch_rec RECORD;
BEGIN
  -- User verification
  v_user_id := COALESCE(auth.uid(), p_dispatched_by);

  IF p_source_branch_id = p_destination_branch_id THEN
    RAISE EXCEPTION 'Source and destination branch cannot be the same.';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Transfer items list cannot be empty.';
  END IF;

  -- Generate unique transfer number e.g. TRF-20261003-ABCD
  v_trf_number := 'TRF-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text from 1 for 4));

  -- Insert stock_transfers record
  INSERT INTO public.stock_transfers (
    transfer_number,
    source_branch_id,
    destination_branch_id,
    status,
    dispatched_by,
    dispatched_at,
    notes
  ) VALUES (
    v_trf_number,
    p_source_branch_id,
    p_destination_branch_id,
    'IN_TRANSIT',
    v_user_id,
    now(),
    NULLIF(trim(p_notes), '')
  ) RETURNING id INTO v_transfer_id;

  -- Process each item (FEFO batch allocation from source branch)
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variant_id := (v_elem->>'product_variant_id')::UUID;
    v_req_qty := (v_elem->>'quantity')::NUMERIC;

    IF v_req_qty IS NULL OR v_req_qty <= 0 THEN
      RAISE EXCEPTION 'Dispatched quantity must be greater than zero.';
    END IF;

    SELECT pv.name, p.name INTO v_variant_name, v_product_name
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = v_variant_id AND pv.active = true AND p.active = true;

    IF v_variant_name IS NULL THEN
      RAISE EXCEPTION 'Product variant ID % is inactive or does not exist.', v_variant_id;
    END IF;

    v_rem_qty := v_req_qty;

    -- FEFO batch allocation from source branch
    FOR v_batch_rec IN
      SELECT i.id AS inv_id, i.batch_id, i.quantity_available, pb.batch_number
      FROM public.inventory i
      JOIN public.product_batches pb ON pb.id = i.batch_id
      WHERE i.branch_id = p_source_branch_id
        AND i.product_variant_id = v_variant_id
        AND i.quantity_available > 0
        AND pb.expiry_date >= CURRENT_DATE
      ORDER BY pb.expiry_date ASC, pb.created_at ASC
      FOR UPDATE OF i
    LOOP
      IF v_rem_qty <= 0 THEN EXIT; END IF;

      v_alloc_qty := LEAST(v_rem_qty, v_batch_rec.quantity_available);

      -- Insert transfer item line
      INSERT INTO public.stock_transfer_items (
        transfer_id,
        product_variant_id,
        batch_id,
        quantity_dispatched,
        notes
      ) VALUES (
        v_transfer_id,
        v_variant_id,
        v_batch_rec.batch_id,
        v_alloc_qty,
        NULLIF(trim(v_elem->>'notes'), '')
      );

      v_rem_qty := v_rem_qty - v_alloc_qty;
    END LOOP;

    IF v_rem_qty > 0 THEN
      RAISE EXCEPTION 'Source branch has insufficient unexpired stock for "% (%)". Requested: %, Available: %',
        v_product_name, v_variant_name, v_req_qty, (v_req_qty - v_rem_qty);
    END IF;
  END LOOP;

  RETURN v_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 7. ATOMIC RPC FUNCTION TO APPROVE AND PROCESS TRANSFER RECEIPT
-- Deducts stock from source branch, adds stock to destination branch,
-- and logs immutable TRANSFER_OUT and TRANSFER_IN inventory movements.
CREATE OR REPLACE FUNCTION public.process_stock_transfer_receipt(
  p_transfer_id UUID,
  p_received_items JSONB,
  p_discrepancy_notes TEXT,
  p_received_by UUID
) RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_transfer_rec RECORD;
  v_elem JSONB;
  v_item_id UUID;
  v_qty_received NUMERIC;
  v_item_rec RECORD;
  v_dest_inv_id UUID;
  v_dest_current_qty NUMERIC;
  v_discrepancy_qty NUMERIC;
BEGIN
  v_user_id := COALESCE(auth.uid(), p_received_by);

  -- Fetch transfer details
  SELECT * INTO v_transfer_rec
  FROM public.stock_transfers
  WHERE id = p_transfer_id;

  IF v_transfer_rec.id IS NULL THEN
    RAISE EXCEPTION 'Transfer ID % does not exist.', p_transfer_id;
  END IF;

  IF v_transfer_rec.status = 'RECEIVED' THEN
    RAISE EXCEPTION 'Transfer % has already been received.', v_transfer_rec.transfer_number;
  ELSIF v_transfer_rec.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'Transfer % was cancelled and cannot be received.', v_transfer_rec.transfer_number;
  END IF;

  -- Verify destination branch authorization
  IF NOT (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    v_transfer_rec.destination_branch_id = public.get_auth_branch_id()
  ) THEN
    RAISE EXCEPTION 'Access denied: Only destination branch employees or owner can approve receipt of transfer.';
  END IF;

  -- Process each received item line
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_received_items)
  LOOP
    v_item_id := (v_elem->>'transfer_item_id')::UUID;
    v_qty_received := (v_elem->>'quantity_received')::NUMERIC;

    IF v_qty_received IS NULL OR v_qty_received < 0 THEN
      RAISE EXCEPTION 'Received quantity cannot be negative.';
    END IF;

    SELECT sti.*, pv.name AS variant_name, p.name AS product_name
    INTO v_item_rec
    FROM public.stock_transfer_items sti
    JOIN public.product_variants pv ON pv.id = sti.product_variant_id
    JOIN public.products p ON p.id = pv.product_id
    WHERE sti.id = v_item_id AND sti.transfer_id = p_transfer_id;

    IF v_item_rec.id IS NULL THEN
      RAISE EXCEPTION 'Transfer item ID % not found for this transfer.', v_item_id;
    END IF;

    IF v_qty_received > v_item_rec.quantity_dispatched THEN
      RAISE EXCEPTION 'Received quantity (%) cannot exceed dispatched quantity (%) for "% (%)".',
        v_qty_received, v_item_rec.quantity_dispatched, v_item_rec.product_name, v_item_rec.variant_name;
    END IF;

    -- Update received quantity on transfer item line
    UPDATE public.stock_transfer_items
    SET quantity_received = v_qty_received
    WHERE id = v_item_id;

    -- 1. Deduct quantity_dispatched from SOURCE BRANCH inventory
    UPDATE public.inventory
    SET quantity_available = GREATEST(0, quantity_available - v_item_rec.quantity_dispatched)
    WHERE branch_id = v_transfer_rec.source_branch_id
      AND product_variant_id = v_item_rec.product_variant_id
      AND batch_id = v_item_rec.batch_id;

    -- Log TRANSFER_OUT movement for Source Branch
    INSERT INTO public.inventory_movements (
      branch_id, product_variant_id, batch_id, movement_type, quantity,
      reference_type, reference_id, notes, performed_by
    ) VALUES (
      v_transfer_rec.source_branch_id, v_item_rec.product_variant_id, v_item_rec.batch_id,
      'TRANSFER_OUT', v_item_rec.quantity_dispatched, 'stock_transfers', p_transfer_id,
      'Stock Transfer Out to ' || v_transfer_rec.transfer_number, v_user_id
    );

    -- 2. Add quantity_received to DESTINATION BRANCH inventory
    IF v_qty_received > 0 THEN
      SELECT id, quantity_available INTO v_dest_inv_id, v_dest_current_qty
      FROM public.inventory
      WHERE branch_id = v_transfer_rec.destination_branch_id
        AND product_variant_id = v_item_rec.product_variant_id
        AND batch_id = v_item_rec.batch_id;

      IF v_dest_inv_id IS NOT NULL THEN
        UPDATE public.inventory
        SET quantity_available = quantity_available + v_qty_received
        WHERE id = v_dest_inv_id;
      ELSE
        INSERT INTO public.inventory (
          branch_id, product_variant_id, batch_id, quantity_available, quantity_in_transit
        ) VALUES (
          v_transfer_rec.destination_branch_id, v_item_rec.product_variant_id, v_item_rec.batch_id,
          v_qty_received, 0
        );
      END IF;

      -- Log TRANSFER_IN movement for Destination Branch
      INSERT INTO public.inventory_movements (
        branch_id, product_variant_id, batch_id, movement_type, quantity,
        reference_type, reference_id, notes, performed_by
      ) VALUES (
        v_transfer_rec.destination_branch_id, v_item_rec.product_variant_id, v_item_rec.batch_id,
        'TRANSFER_IN', v_qty_received, 'stock_transfers', p_transfer_id,
        'Stock Transfer In from ' || v_transfer_rec.transfer_number, v_user_id
      );
    END IF;

    -- 3. Log discrepancy if quantity_received < quantity_dispatched
    v_discrepancy_qty := v_item_rec.quantity_dispatched - v_qty_received;
    IF v_discrepancy_qty > 0 THEN
      INSERT INTO public.inventory_movements (
        branch_id, product_variant_id, batch_id, movement_type, quantity,
        reference_type, reference_id, notes, performed_by
      ) VALUES (
        v_transfer_rec.destination_branch_id, v_item_rec.product_variant_id, v_item_rec.batch_id,
        'DAMAGED', v_discrepancy_qty, 'stock_transfers', p_transfer_id,
        'Discrepancy/Shortfall on receipt of ' || v_transfer_rec.transfer_number || ': ' || COALESCE(p_discrepancy_notes, 'Quantity shortfall'),
        v_user_id
      );
    END IF;
  END LOOP;

  -- Update stock_transfers status to RECEIVED
  UPDATE public.stock_transfers
  SET status = 'RECEIVED',
      received_by = v_user_id,
      received_at = now(),
      discrepancy_notes = NULLIF(trim(p_discrepancy_notes), '')
  WHERE id = p_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.create_stock_transfer(UUID, UUID, TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_stock_transfer_receipt(UUID, JSONB, TEXT, UUID) TO authenticated;

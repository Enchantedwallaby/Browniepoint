-- Migration Version: 20261014000001_backdated_stock_transfers_rpc.sql
-- Description: Adds optional p_dispatched_at parameter to atomic stock transfer creation RPCs.
--              Preserves 100% backward compatibility for callers with default now().

-- 1. Main Branch Fresh Production Stock Transfer RPC with optional historical dispatch date
CREATE OR REPLACE FUNCTION public.create_main_branch_stock_transfer(
  p_source_branch_id UUID,
  p_destination_branch_id UUID,
  p_notes TEXT,
  p_dispatched_by UUID,
  p_items JSONB,
  p_dispatched_at TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_transfer_id UUID;
  v_transfer_number TEXT;
  v_elem JSONB;
  v_variant_id UUID;
  v_variant_name TEXT;
  v_product_name TEXT;
  v_product_category public.product_category;
  v_req_qty NUMERIC;
  v_batch_id UUID;
  v_item_number INTEGER := 0;
  v_dispatched_at TIMESTAMPTZ;
  v_production_date DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to dispatch Main Branch products.';
  END IF;

  IF NOT (
    public.is_owner() OR (
      public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' AND
      p_source_branch_id = public.get_auth_branch_id()
    )
  ) THEN
    RAISE EXCEPTION 'Only the Owner or assigned Main Branch employee can dispatch Main Branch products.';
  END IF;

  IF p_source_branch_id = p_destination_branch_id THEN
    RAISE EXCEPTION 'Source and destination branch cannot be the same.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches
    WHERE id = p_source_branch_id AND active = true AND branch_type = 'MAIN'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.branches
    WHERE id = p_destination_branch_id AND active = true AND branch_type = 'SUB_BRANCH'
  ) THEN
    RAISE EXCEPTION 'An active Main Branch source and Sub-Branch destination are required.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Transfer items list cannot be empty.';
  END IF;

  v_dispatched_at := COALESCE(p_dispatched_at, now());
  v_production_date := v_dispatched_at::DATE;

  v_transfer_number := 'TRF-' || to_char(v_dispatched_at, 'YYYYMMDD') || '-' ||
    upper(substring(gen_random_uuid()::text from 1 for 4));

  INSERT INTO public.stock_transfers (
    transfer_number, source_branch_id, destination_branch_id, status,
    dispatched_by, dispatched_at, notes
  ) VALUES (
    v_transfer_number, p_source_branch_id, p_destination_branch_id, 'IN_TRANSIT',
    v_user_id, v_dispatched_at, NULLIF(trim(p_notes), '')
  ) RETURNING id INTO v_transfer_id;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variant_id := (v_elem->>'product_variant_id')::UUID;
    v_req_qty := (v_elem->>'quantity')::NUMERIC;

    IF v_req_qty IS NULL OR v_req_qty <= 0 OR v_req_qty::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'Dispatched quantity must be a finite number greater than zero.';
    END IF;

    SELECT pv.name, p.name, p.category
    INTO v_variant_name, v_product_name, v_product_category
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = v_variant_id AND pv.active = true AND p.active = true;
    IF v_variant_name IS NULL THEN
      RAISE EXCEPTION 'Product variant ID % is inactive or does not exist.', v_variant_id;
    END IF;

    v_item_number := v_item_number + 1;
    INSERT INTO public.product_batches (
      product_variant_id, batch_number, production_date, expiry_date, initial_quantity
    ) VALUES (
      v_variant_id,
      v_transfer_number || '-' || v_item_number,
      v_production_date,
      v_production_date + CASE
        WHEN v_product_category IN ('Cookies', 'Tea-Time Cakes', 'Packaging', 'Utensils') THEN 30
        ELSE 3
      END,
      v_req_qty
    ) RETURNING id INTO v_batch_id;

    INSERT INTO public.stock_transfer_items (
      transfer_id, product_variant_id, batch_id, quantity_dispatched, notes
    ) VALUES (
      v_transfer_id, v_variant_id, v_batch_id, v_req_qty,
      NULLIF(trim(v_elem->>'notes'), '')
    );
  END LOOP;

  RETURN v_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.create_main_branch_stock_transfer(UUID, UUID, TEXT, UUID, JSONB, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_main_branch_stock_transfer(UUID, UUID, TEXT, UUID, JSONB, TIMESTAMPTZ) TO authenticated;

-- 2. Sub-Branch to Sub-Branch Stock Transfer RPC with optional historical dispatch date
CREATE OR REPLACE FUNCTION public.create_stock_transfer(
  p_source_branch_id UUID,
  p_destination_branch_id UUID,
  p_notes TEXT,
  p_dispatched_by UUID,
  p_items JSONB,
  p_dispatched_at TIMESTAMPTZ DEFAULT NULL
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
  v_dispatched_at TIMESTAMPTZ;
BEGIN
  v_user_id := COALESCE(auth.uid(), p_dispatched_by);

  IF p_source_branch_id = p_destination_branch_id THEN
    RAISE EXCEPTION 'Source and destination branch cannot be the same.';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Transfer items list cannot be empty.';
  END IF;

  v_dispatched_at := COALESCE(p_dispatched_at, now());
  v_trf_number := 'TRF-' || to_char(v_dispatched_at, 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text from 1 for 4));

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
    v_dispatched_at,
    NULLIF(trim(p_notes), '')
  ) RETURNING id INTO v_transfer_id;

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

    FOR v_batch_rec IN
      SELECT i.id AS inv_id, i.batch_id, i.quantity_available, pb.batch_number
      FROM public.inventory i
      JOIN public.product_batches pb ON pb.id = i.batch_id
      WHERE i.branch_id = p_source_branch_id
        AND i.product_variant_id = v_variant_id
        AND i.quantity_available > 0
        AND pb.expiry_date >= v_dispatched_at::DATE
      ORDER BY pb.expiry_date ASC, pb.created_at ASC
      FOR UPDATE OF i
    LOOP
      IF v_rem_qty <= 0 THEN EXIT; END IF;

      v_alloc_qty := LEAST(v_rem_qty, v_batch_rec.quantity_available);

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
      RAISE EXCEPTION 'Insufficient stock for "% (%)". Required: %, Missing: %',
        v_product_name, v_variant_name, v_req_qty, v_rem_qty;
    END IF;
  END LOOP;

  RETURN v_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.create_stock_transfer(UUID, UUID, TEXT, UUID, JSONB, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_stock_transfer(UUID, UUID, TEXT, UUID, JSONB, TIMESTAMPTZ) TO authenticated;

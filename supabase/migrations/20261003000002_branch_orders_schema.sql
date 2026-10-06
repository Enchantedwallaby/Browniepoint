-- ====================================================================
-- BROWNIE POINT OPERATIONS SYSTEM - BRANCH ORDERS TO MAIN BRANCH FULFILLMENT
-- Migration Version: 20261003000002_branch_orders_schema.sql
-- Description:
--   1. Enhances `public.orders` to support multi-branch procurement requests.
--   2. Creates `public.order_items` for multi-item order lines.
--   3. Adds `order_id` link to `public.stock_transfers`.
--   4. Configures RLS policies ensuring role-based order boundaries.
--   5. Implements atomic RPCs for order creation and lifecycle transitions.
-- ====================================================================

-- 1. EXTEND ORDER STATUS ENUM VALUES (IF NOT EXISTS)
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'PREPARING';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'DISPATCHED';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'REJECTED';

-- 2. ENHANCE ORDERS TABLE
ALTER TABLE public.orders ALTER COLUMN customer_name DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN customer_name SET DEFAULT NULL;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'BRANCH_ORDER';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS required_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 day');
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS transfer_id UUID REFERENCES public.stock_transfers(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 3. CREATE ORDER_ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_items_order   ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant ON public.order_items(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_orders_urgent       ON public.orders(is_urgent);
CREATE INDEX IF NOT EXISTS idx_orders_req_date     ON public.orders(required_date);

-- 4. LINK STOCK TRANSFERS TO ORDERS
ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transfers_order_id ON public.stock_transfers(order_id);

-- 5. RLS POLICIES FOR ORDER_ITEMS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
CREATE POLICY "order_items_select"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.branch_id = public.get_auth_branch_id()
    )
  );

DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
CREATE POLICY "order_items_insert"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.branch_id = public.get_auth_branch_id()
    )
  );

DROP POLICY IF EXISTS "order_items_update" ON public.order_items;
CREATE POLICY "order_items_update"
  ON public.order_items FOR UPDATE TO authenticated
  USING (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.branch_id = public.get_auth_branch_id()
    )
  );

-- 6. ATOMIC RPC FUNCTION: CREATE BRANCH ORDER
-- Strictly creates the order request WITHOUT touching or deducting inventory.
CREATE OR REPLACE FUNCTION public.create_branch_order(
  p_branch_id UUID,
  p_required_date DATE,
  p_is_urgent BOOLEAN,
  p_notes TEXT,
  p_items JSONB,
  p_photo_url TEXT,
  p_created_by UUID
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_order_id UUID;
  v_order_number TEXT;
  v_branch_active BOOLEAN;
  v_elem JSONB;
  v_variant_id UUID;
  v_qty NUMERIC;
  v_item_notes TEXT;
  v_variant_active BOOLEAN;
  v_product_active BOOLEAN;
  v_variant_name TEXT;
  v_product_name TEXT;
  v_rand INT;
BEGIN
  v_user_id := COALESCE(auth.uid(), p_created_by);
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create a branch order.';
  END IF;

  -- 1. Validate branch active status & user authorization
  SELECT active INTO v_branch_active FROM public.branches WHERE id = p_branch_id;
  IF v_branch_active IS NULL THEN
    RAISE EXCEPTION 'Branch ID % does not exist.', p_branch_id;
  ELSIF NOT v_branch_active THEN
    RAISE EXCEPTION 'Branch % is currently inactive.', p_branch_id;
  END IF;

  IF NOT (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    p_branch_id = public.get_auth_branch_id()
  ) THEN
    RAISE EXCEPTION 'Access denied: You can only create orders for your assigned branch.';
  END IF;

  -- 2. Validate required date (cannot be past date)
  IF p_required_date IS NULL OR p_required_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Required delivery date must be today or a future date.';
  END IF;

  -- 3. Validate items payload
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one product item.';
  END IF;

  -- 4. Generate unique order number (e.g. ORD-20261004-1234)
  v_rand := floor(1000 + random() * 9000)::INT;
  v_order_number := 'ORD-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || v_rand::TEXT;

  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.orders WHERE order_number = v_order_number) LOOP
    v_rand := floor(1000 + random() * 9000)::INT;
    v_order_number := 'ORD-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || v_rand::TEXT;
  END LOOP;

  -- 5. Insert Order record (Status = PENDING)
  -- Note: NO INVENTORY IS DEDUCTED. Inventory is only deducted upon physical stock transfer.
  INSERT INTO public.orders (
    branch_id,
    order_number,
    customer_name,
    is_custom_cake,
    is_urgent,
    required_date,
    status,
    notes,
    photo_url,
    created_by
  ) VALUES (
    p_branch_id,
    v_order_number,
    'Branch Requisition',
    false,
    COALESCE(p_is_urgent, false),
    p_required_date,
    'PENDING',
    NULLIF(trim(p_notes), ''),
    NULLIF(trim(p_photo_url), ''),
    v_user_id
  ) RETURNING id INTO v_order_id;

  -- 6. Insert Order Items
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variant_id := (v_elem->>'product_variant_id')::UUID;
    v_qty := (v_elem->>'quantity')::NUMERIC;
    v_item_notes := NULLIF(trim(v_elem->>'notes'), '');

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be greater than zero.';
    END IF;

    -- Validate active variant & product
    SELECT pv.active, p.active, pv.name, p.name
    INTO v_variant_active, v_product_active, v_variant_name, v_product_name
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = v_variant_id;

    IF v_variant_name IS NULL OR NOT v_variant_active OR NOT v_product_active THEN
      RAISE EXCEPTION 'Product variant is inactive or does not exist.';
    END IF;

    INSERT INTO public.order_items (
      order_id,
      product_variant_id,
      quantity,
      notes
    ) VALUES (
      v_order_id,
      v_variant_id,
      v_qty,
      v_item_notes
    );
  END LOOP;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. ATOMIC RPC FUNCTION: UPDATE BRANCH ORDER STATUS
-- Enforces valid status lifecycle transitions, preventing arbitrary jumps.
CREATE OR REPLACE FUNCTION public.update_branch_order_status(
  p_order_id UUID,
  p_new_status public.order_status,
  p_rejection_reason TEXT,
  p_notes TEXT,
  p_transfer_id UUID,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_order RECORD;
BEGIN
  v_user_id := COALESCE(auth.uid(), p_user_id);
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to update order status.';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order ID % does not exist.', p_order_id;
  END IF;

  -- Enforce valid lifecycle transitions
  IF v_order.status = 'PENDING' THEN
    IF p_new_status NOT IN ('ACCEPTED', 'REJECTED', 'CANCELLED') THEN
      RAISE EXCEPTION 'Invalid status transition: PENDING orders can only be ACCEPTED, REJECTED, or CANCELLED.';
    END IF;
  ELSIF v_order.status = 'ACCEPTED' THEN
    IF p_new_status NOT IN ('PREPARING', 'CANCELLED') THEN
      RAISE EXCEPTION 'Invalid status transition: ACCEPTED orders can only move to PREPARING or CANCELLED.';
    END IF;
  ELSIF v_order.status = 'PREPARING' THEN
    IF p_new_status NOT IN ('READY') THEN
      RAISE EXCEPTION 'Invalid status transition: PREPARING orders can only move to READY.';
    END IF;
  ELSIF v_order.status = 'READY' THEN
    IF p_new_status NOT IN ('DISPATCHED') THEN
      RAISE EXCEPTION 'Invalid status transition: READY orders can only move to DISPATCHED.';
    END IF;
  ELSIF v_order.status = 'DISPATCHED' THEN
    IF p_new_status NOT IN ('COMPLETED') THEN
      RAISE EXCEPTION 'Invalid status transition: DISPATCHED orders can only move to COMPLETED.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Order % is in terminal status % and cannot be changed.', v_order.order_number, v_order.status;
  END IF;

  -- Rejection reason is strictly mandatory when rejecting
  IF p_new_status = 'REJECTED' THEN
    IF p_rejection_reason IS NULL OR trim(p_rejection_reason) = '' THEN
      RAISE EXCEPTION 'Rejection reason is required when rejecting an order.';
    END IF;
  END IF;

  -- Authorization check:
  -- Only Main Branch / Owner can accept, prepare, ready, dispatch, complete, or reject.
  -- Branch employees can ONLY cancel their own pending/accepted order.
  IF p_new_status = 'CANCELLED' THEN
    IF NOT (
      public.is_owner() OR
      public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
      v_order.branch_id = public.get_auth_branch_id()
    ) THEN
      RAISE EXCEPTION 'Access denied: You cannot cancel an order for another branch.';
    END IF;
  ELSE
    IF NOT (
      public.is_owner() OR
      public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE'
    ) THEN
      RAISE EXCEPTION 'Access denied: Only Main Branch employees or Owner can process branch orders.';
    END IF;
  END IF;

  -- Update order with audit details
  UPDATE public.orders
  SET status = p_new_status,
      rejection_reason = CASE WHEN p_new_status = 'REJECTED' THEN trim(p_rejection_reason) ELSE rejection_reason END,
      rejected_by = CASE WHEN p_new_status = 'REJECTED' THEN v_user_id ELSE rejected_by END,
      rejected_at = CASE WHEN p_new_status = 'REJECTED' THEN now() ELSE rejected_at END,
      accepted_by = CASE WHEN p_new_status = 'ACCEPTED' THEN v_user_id ELSE accepted_by END,
      accepted_at = CASE WHEN p_new_status = 'ACCEPTED' THEN now() ELSE accepted_at END,
      cancelled_by = CASE WHEN p_new_status = 'CANCELLED' THEN v_user_id ELSE cancelled_by END,
      cancelled_at = CASE WHEN p_new_status = 'CANCELLED' THEN now() ELSE cancelled_at END,
      completed_at = CASE WHEN p_new_status = 'COMPLETED' THEN now() ELSE completed_at END,
      transfer_id = COALESCE(p_transfer_id, transfer_id),
      notes = CASE WHEN p_notes IS NOT NULL AND trim(p_notes) <> '' THEN trim(p_notes) ELSE notes END,
      updated_at = now()
  WHERE id = p_order_id;

  -- If a transfer ID was linked, cross-link the stock transfer to this order
  IF p_transfer_id IS NOT NULL THEN
    UPDATE public.stock_transfers
    SET order_id = p_order_id
    WHERE id = p_transfer_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant permissions to authenticated
GRANT EXECUTE ON FUNCTION public.create_branch_order(UUID, DATE, BOOLEAN, TEXT, JSONB, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_branch_order_status(UUID, public.order_status, TEXT, TEXT, UUID, UUID) TO authenticated;

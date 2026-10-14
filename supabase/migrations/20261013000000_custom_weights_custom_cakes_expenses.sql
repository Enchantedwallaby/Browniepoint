-- Migration: 20261013000000_custom_weights_custom_cakes_expenses.sql
-- Description:
-- 1. Adds customer_phone to sales table
-- 2. Adds weight_kg and custom_item_name to sale_items table
-- 3. Updates process_pos_sale RPC to support:
--    - Variable / custom weight sales with accurate rate calculation
--    - Custom Cake sales with manual pricing at both Main Branch and Sub-branches
--    - Sub-branch inventory deduction for custom weights without stock errors on custom items
-- 4. Creates expenses table, expense_payment_method enum, RLS policies, and record_expense RPC

-- 1. SALES TABLE UPDATES
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- 2. SALE ITEMS TABLE UPDATES
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC CHECK (weight_kg IS NULL OR weight_kg > 0),
  ADD COLUMN IF NOT EXISTS custom_item_name TEXT;

-- 3. EXPENSES TABLE & ENUM
DO $$ BEGIN
  CREATE TYPE public.expense_payment_method AS ENUM (
    'CASH',
    'ONLINE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL CHECK (trim(reason) <> ''),
  category TEXT,
  payment_method public.expense_payment_method NOT NULL DEFAULT 'CASH',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_branch_date
  ON public.expenses(branch_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_date
  ON public.expenses(expense_date DESC);

-- Enable RLS on expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_select" ON public.expenses;
CREATE POLICY "expenses_select"
  ON public.expenses FOR SELECT TO authenticated
  USING (
    public.is_owner() OR (
      branch_id = public.get_auth_branch_id()
    )
  );

DROP POLICY IF EXISTS "expenses_insert" ON public.expenses;
CREATE POLICY "expenses_insert"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (
    recorded_by = auth.uid() AND (
      public.is_owner() OR
      branch_id = public.get_auth_branch_id()
    )
  );

DROP POLICY IF EXISTS "expenses_update" ON public.expenses;
CREATE POLICY "expenses_update"
  ON public.expenses FOR UPDATE TO authenticated
  USING (
    public.is_owner()
  )
  WITH CHECK (
    public.is_owner()
  );

DROP POLICY IF EXISTS "expenses_delete" ON public.expenses;
CREATE POLICY "expenses_delete"
  ON public.expenses FOR DELETE TO authenticated
  USING (
    public.is_owner()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;

-- RPC to record expense with strict server-side validation
CREATE OR REPLACE FUNCTION public.record_expense(
  p_branch_id UUID,
  p_amount NUMERIC,
  p_reason TEXT,
  p_category TEXT DEFAULT NULL,
  p_payment_method public.expense_payment_method DEFAULT 'CASH',
  p_expense_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role public.user_role;
  v_user_branch_id UUID;
  v_branch_active BOOLEAN;
  v_expense_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to record expenses.';
  END IF;

  SELECT role, branch_id INTO v_user_role, v_user_branch_id
  FROM public.profiles
  WHERE id = v_user_id AND active = true;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Active user profile not found.';
  END IF;

  -- Validate Branch
  SELECT active INTO v_branch_active
  FROM public.branches
  WHERE id = p_branch_id;

  IF v_branch_active IS NULL OR NOT v_branch_active THEN
    RAISE EXCEPTION 'Selected branch is invalid or inactive.';
  END IF;

  -- Authorization check: Branch employees can only record for their assigned branch
  IF v_user_role <> 'OWNER' AND v_user_branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'Access denied: You cannot record expenses for another branch.';
  END IF;

  -- Amount & reason validations
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Expense amount must be a positive number greater than zero.';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Expense reason / description is required.';
  END IF;

  INSERT INTO public.expenses (
    branch_id,
    recorded_by,
    amount,
    reason,
    category,
    payment_method,
    expense_date,
    notes
  ) VALUES (
    p_branch_id,
    v_user_id,
    ROUND(p_amount, 2),
    trim(p_reason),
    NULLIF(trim(p_category), ''),
    p_payment_method,
    COALESCE(p_expense_date, CURRENT_DATE),
    NULLIF(trim(p_notes), '')
  ) RETURNING id INTO v_expense_id;

  RETURN v_expense_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.record_expense(
  UUID, NUMERIC, TEXT, TEXT, public.expense_payment_method, DATE, TEXT
) TO authenticated;

-- RPC to delete expense (Owner only)
CREATE OR REPLACE FUNCTION public.delete_expense(
  p_expense_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only the Owner can delete expense records.';
  END IF;

  DELETE FROM public.expenses WHERE id = p_expense_id;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.delete_expense(UUID) TO authenticated;

-- 4. ATOMIC PROCESS_POS_SALE RPC (9 ARGUMENTS CORE ENGINE)
CREATE OR REPLACE FUNCTION public.process_pos_sale(
  p_branch_id UUID,
  p_payment_method public.payment_method,
  p_amount_cash NUMERIC,
  p_amount_online NUMERIC,
  p_customer_name TEXT,
  p_notes TEXT,
  p_performed_by UUID,
  p_order_id UUID,
  p_items JSONB
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_sale_id UUID;
  v_total_amount NUMERIC := 0;
  v_amount_cash NUMERIC := 0;
  v_amount_online NUMERIC := 0;
  v_elem JSONB;
  v_variant_id UUID;
  v_variant_name TEXT;
  v_product_name TEXT;
  v_pricing_type public.pricing_type;
  v_base_price NUMERIC;
  v_req_qty NUMERIC;
  v_deduct_qty NUMERIC;
  v_rem_qty NUMERIC;
  v_alloc_qty NUMERIC;
  v_unit_price NUMERIC;
  v_is_custom BOOLEAN;
  v_item_notes TEXT;
  v_weight_kg NUMERIC;
  v_custom_item_name TEXT;
  v_branch_active BOOLEAN;
  v_branch_type public.branch_type;
  v_batch_rec RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    IF p_performed_by IS NOT NULL THEN
      v_user_id := p_performed_by;
    ELSE
      RAISE EXCEPTION 'Authentication required to process POS sale.';
    END IF;
  END IF;

  SELECT active, branch_type INTO v_branch_active, v_branch_type
  FROM public.branches WHERE id = p_branch_id;
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
    RAISE EXCEPTION 'Access denied: User is not authorized for branch %', p_branch_id;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cannot process sale with an empty cart.';
  END IF;

  -- PASS 1: VALIDATE PRICES AND COMPUTE TOTALS
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variant_id := (v_elem->>'product_variant_id')::UUID;
    v_req_qty := (v_elem->>'quantity')::NUMERIC;
    v_unit_price := (v_elem->>'unit_price')::NUMERIC;
    v_weight_kg := (v_elem->>'weight_kg')::NUMERIC;

    IF v_req_qty IS NULL OR v_req_qty <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be greater than zero.';
    END IF;
    IF v_unit_price IS NULL OR v_unit_price < 0 THEN
      RAISE EXCEPTION 'Item unit price cannot be negative.';
    END IF;

    SELECT pv.name, p.name INTO v_variant_name, v_product_name
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = v_variant_id AND pv.active = true AND p.active = true;
    IF v_variant_name IS NULL THEN
      RAISE EXCEPTION 'Product variant ID % is inactive or does not exist.', v_variant_id;
    END IF;

    SELECT pr.pricing_type, pr.base_price INTO v_pricing_type, v_base_price
    FROM public.pricing_rules pr
    WHERE pr.product_variant_id = v_variant_id AND pr.active = true
    ORDER BY pr.effective_from DESC LIMIT 1;

    v_is_custom := (v_pricing_type = 'CUSTOM') OR (v_product_name = 'Custom Cake') OR COALESCE((v_elem->>'is_custom_price')::BOOLEAN, false);

    IF NOT v_is_custom AND v_base_price IS NOT NULL THEN
      -- If selling by custom weight, calculate unit_price from base_price * weight_kg
      IF v_weight_kg IS NOT NULL AND v_weight_kg > 0 THEN
        v_unit_price := ROUND(v_base_price * v_weight_kg, 2);
      ELSE
        v_unit_price := v_base_price;
      END IF;
    END IF;

    v_total_amount := v_total_amount + (v_req_qty * v_unit_price);
  END LOOP;

  v_total_amount := ROUND(v_total_amount, 2);

  -- PASS 2: PAYMENT METHOD VALIDATION
  IF p_payment_method = 'CASH' THEN
    v_amount_cash := v_total_amount;
    v_amount_online := 0;
  ELSIF p_payment_method IN ('ONLINE', 'CARD', 'UPI') THEN
    v_amount_cash := 0;
    v_amount_online := v_total_amount;
  ELSIF p_payment_method = 'MIXED' THEN
    v_amount_cash := ROUND(COALESCE(p_amount_cash, 0), 2);
    v_amount_online := ROUND(COALESCE(p_amount_online, 0), 2);
    IF ABS((v_amount_cash + v_amount_online) - v_total_amount) > 0.01 THEN
      RAISE EXCEPTION 'Mixed payment total mismatch: Cash (₹%) + Online (₹%) = ₹%, which does not equal grand total ₹%',
        v_amount_cash, v_amount_online, (v_amount_cash + v_amount_online), v_total_amount;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid payment method %', p_payment_method;
  END IF;

  -- INSERT SALES HEADER
  INSERT INTO public.sales (
    branch_id, sale_date, total_amount, payment_method, amount_cash, amount_online,
    customer_name, notes, status, performed_by, order_id
  ) VALUES (
    p_branch_id, now(), v_total_amount, p_payment_method, v_amount_cash, v_amount_online,
    NULLIF(trim(p_customer_name), ''), NULLIF(trim(p_notes), ''), 'COMPLETED', v_user_id, p_order_id
  ) RETURNING id INTO v_sale_id;

  -- PASS 3: INSERT SALE ITEMS & DEDUCT INVENTORY
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variant_id := (v_elem->>'product_variant_id')::UUID;
    v_req_qty := (v_elem->>'quantity')::NUMERIC;
    v_unit_price := (v_elem->>'unit_price')::NUMERIC;
    v_item_notes := NULLIF(trim(v_elem->>'notes'), '');
    v_weight_kg := (v_elem->>'weight_kg')::NUMERIC;
    v_custom_item_name := NULLIF(trim(v_elem->>'custom_item_name'), '');
    -- Deduction quantity: if custom weight specified, use deduct_qty or weight_kg * quantity, else standard quantity
    v_deduct_qty := COALESCE(
      (v_elem->>'deduct_qty')::NUMERIC,
      CASE WHEN v_weight_kg IS NOT NULL AND v_weight_kg > 0 THEN ROUND(v_weight_kg * v_req_qty, 3)
           ELSE v_req_qty END
    );

    SELECT pv.name, p.name INTO v_variant_name, v_product_name
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = v_variant_id;

    SELECT pr.pricing_type, pr.base_price INTO v_pricing_type, v_base_price
    FROM public.pricing_rules pr
    WHERE pr.product_variant_id = v_variant_id AND pr.active = true
    ORDER BY pr.effective_from DESC LIMIT 1;

    v_is_custom := (v_pricing_type = 'CUSTOM') OR (v_product_name = 'Custom Cake') OR COALESCE((v_elem->>'is_custom_price')::BOOLEAN, false);
    IF NOT v_is_custom AND v_base_price IS NOT NULL THEN
      IF v_weight_kg IS NOT NULL AND v_weight_kg > 0 THEN
        v_unit_price := ROUND(v_base_price * v_weight_kg, 2);
      ELSE
        v_unit_price := v_base_price;
      END IF;
    END IF;

    -- MAIN BRANCH OR CUSTOM ITEMS DO NOT DEDUCT BATCH INVENTORY
    IF v_branch_type = 'MAIN' OR v_is_custom THEN
      INSERT INTO public.sale_items (
        sale_id, product_variant_id, batch_id, quantity, unit_price_snapshot,
        is_custom_price, custom_price_entered_by, custom_price_entered_at, notes,
        weight_kg, custom_item_name
      ) VALUES (
        v_sale_id, v_variant_id, NULL, v_req_qty, v_unit_price, v_is_custom,
        CASE WHEN v_is_custom THEN v_user_id ELSE NULL END,
        CASE WHEN v_is_custom THEN now() ELSE NULL END, v_item_notes,
        v_weight_kg, v_custom_item_name
      );
      CONTINUE;
    END IF;

    -- SUB-BRANCH STANDARD SALE: DEDUCT VIA FEFO
    v_rem_qty := v_deduct_qty;
    FOR v_batch_rec IN
      SELECT i.id AS inv_id, i.batch_id, i.quantity_available, pb.batch_number
      FROM public.inventory i
      JOIN public.product_batches pb ON pb.id = i.batch_id
      WHERE i.branch_id = p_branch_id
        AND i.product_variant_id = v_variant_id
        AND i.quantity_available > 0
        AND pb.expiry_date >= CURRENT_DATE
      ORDER BY pb.expiry_date ASC, pb.created_at ASC
      FOR UPDATE OF i
    LOOP
      EXIT WHEN v_rem_qty <= 0;
      v_alloc_qty := LEAST(v_rem_qty, v_batch_rec.quantity_available);

      INSERT INTO public.sale_items (
        sale_id, product_variant_id, batch_id, quantity, unit_price_snapshot,
        is_custom_price, custom_price_entered_by, custom_price_entered_at, notes,
        weight_kg, custom_item_name
      ) VALUES (
        v_sale_id, v_variant_id, v_batch_rec.batch_id, v_req_qty, v_unit_price,
        v_is_custom, CASE WHEN v_is_custom THEN v_user_id ELSE NULL END,
        CASE WHEN v_is_custom THEN now() ELSE NULL END, v_item_notes,
        v_weight_kg, v_custom_item_name
      );

      UPDATE public.inventory SET quantity_available = quantity_available - v_alloc_qty
      WHERE id = v_batch_rec.inv_id;

      INSERT INTO public.inventory_movements (
        branch_id, product_variant_id, batch_id, movement_type, quantity,
        reference_type, reference_id, notes, performed_by
      ) VALUES (
        p_branch_id, v_variant_id, v_batch_rec.batch_id, 'SALE', v_alloc_qty,
        'sales', v_sale_id, 'POS Sale Receipt #' || substring(v_sale_id::text from 1 for 8), v_user_id
      );

      v_rem_qty := v_rem_qty - v_alloc_qty;
    END LOOP;

    IF v_rem_qty > 0 THEN
      RAISE EXCEPTION 'Insufficient unexpired stock for "% (%)". Requested: %, Available: %',
        v_product_name, v_variant_name, v_deduct_qty, (v_deduct_qty - v_rem_qty);
    END IF;
  END LOOP;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.process_pos_sale(
  UUID, public.payment_method, NUMERIC, NUMERIC, TEXT, TEXT, UUID, UUID, JSONB
) TO authenticated;

-- 5. ATOMIC PROCESS_POS_SALE OVERLOAD (10 ARGUMENTS WITH DISCOUNT)
CREATE OR REPLACE FUNCTION public.process_pos_sale(
  p_branch_id UUID,
  p_payment_method public.payment_method,
  p_amount_cash NUMERIC,
  p_amount_online NUMERIC,
  p_customer_name TEXT,
  p_notes TEXT,
  p_performed_by UUID,
  p_order_id UUID,
  p_items JSONB,
  p_discount_amount NUMERIC
) RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
  v_subtotal NUMERIC;
  v_discount NUMERIC;
  v_final_total NUMERIC;
  v_amount_cash NUMERIC := 0;
  v_amount_online NUMERIC := 0;
BEGIN
  IF COALESCE(p_discount_amount, 0) < 0 THEN
    RAISE EXCEPTION 'Discount cannot be negative.';
  END IF;

  IF p_payment_method::TEXT NOT IN ('CASH', 'ONLINE', 'CARD', 'UPI', 'MIXED') THEN
    RAISE EXCEPTION 'Invalid payment method %', p_payment_method;
  END IF;

  -- Call the 9-argument core engine
  v_sale_id := public.process_pos_sale(
    p_branch_id,
    'CASH'::public.payment_method,
    0,
    0,
    p_customer_name,
    p_notes,
    p_performed_by,
    p_order_id,
    p_items
  );

  SELECT total_amount INTO v_subtotal
  FROM public.sales
  WHERE id = v_sale_id;

  v_discount := LEAST(ROUND(COALESCE(p_discount_amount, 0), 2), v_subtotal);
  v_final_total := GREATEST(0, v_subtotal - v_discount);

  IF p_payment_method = 'MIXED' THEN
    v_amount_cash := ROUND(COALESCE(p_amount_cash, 0), 2);
    v_amount_online := ROUND(COALESCE(p_amount_online, 0), 2);

    IF ABS((v_amount_cash + v_amount_online) - v_final_total) > 0.01 THEN
      RAISE EXCEPTION 'Mixed payment total mismatch: Cash (₹%) + Online (₹%) does not equal discounted total ₹%',
        v_amount_cash, v_amount_online, v_final_total;
    END IF;
  ELSIF p_payment_method = 'CASH' THEN
    v_amount_cash := v_final_total;
  ELSE
    v_amount_online := v_final_total;
  END IF;

  UPDATE public.sales
  SET total_amount = v_final_total,
      discount_amount = v_discount,
      payment_method = p_payment_method,
      amount_cash = v_amount_cash,
      amount_online = v_amount_online
  WHERE id = v_sale_id;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.process_pos_sale(
  UUID, public.payment_method, NUMERIC, NUMERIC, TEXT, TEXT, UUID, UUID, JSONB, NUMERIC
) TO authenticated;

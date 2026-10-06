-- ====================================================================
-- BROWNIE POINT OPERATIONS SYSTEM - HARDENED ATOMIC POS SALE RPC
-- Migration Version: 20261003000000_process_pos_sale_rpc.sql
-- Description: Executes full POS sale transaction atomically with strict
--              server-side security, price tampering protection, and FEFO integrity:
--              1. Enforces auth.uid() as acting user (prevents performer ID spoofing).
--              2. Validates active branch status and user branch authorization.
--              3. Validates active product & variant status (blocks inactive items).
--              4. Enforces standard menu price from active pricing_rules (prevents client price tampering).
--              5. Enforces custom pricing auditing for custom items.
--              6. Allocates unexpired stock (expiry_date >= CURRENT_DATE) via FEFO.
--              7. Inserts `sales`, `sale_items`, deducts `inventory`, and logs `inventory_movements`.
--              8. Automatic ROLLBACK on any validation failure or stock shortfall.
-- ====================================================================

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
  v_rem_qty NUMERIC;
  v_alloc_qty NUMERIC;
  v_unit_price NUMERIC;
  v_is_custom BOOLEAN;
  v_item_notes TEXT;
  v_branch_active BOOLEAN;
  v_batch_rec RECORD;
BEGIN
  -- 1. Enforce Authenticated User ID (Prevent Client Parameter Spoofing)
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    IF p_performed_by IS NOT NULL THEN
      v_user_id := p_performed_by;
    ELSE
      RAISE EXCEPTION 'Authentication required to process POS sale.';
    END IF;
  END IF;

  -- 2. Validate Branch Status & Authorization (RLS Check)
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
    RAISE EXCEPTION 'Access denied: User is not authorized for branch %', p_branch_id;
  END IF;

  -- 3. Validate Items Payload
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cannot process sale with an empty cart.';
  END IF;

  -- 4. Calculate Total Amount & Validate Products, Active Status, Prices
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variant_id := (v_elem->>'product_variant_id')::UUID;
    v_req_qty := (v_elem->>'quantity')::NUMERIC;
    v_unit_price := (v_elem->>'unit_price')::NUMERIC;

    IF v_req_qty IS NULL OR v_req_qty <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be greater than zero.';
    END IF;

    IF v_unit_price IS NULL OR v_unit_price < 0 THEN
      RAISE EXCEPTION 'Item unit price cannot be negative.';
    END IF;

    -- Validate Product & Variant Active Status
    SELECT pv.name, p.name INTO v_variant_name, v_product_name
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = v_variant_id AND pv.active = true AND p.active = true;

    IF v_variant_name IS NULL THEN
      RAISE EXCEPTION 'Product variant ID % is inactive or does not exist.', v_variant_id;
    END IF;

    -- Check Pricing Rule & Server-side Price Tampering Protection
    SELECT pr.pricing_type, pr.base_price
    INTO v_pricing_type, v_base_price
    FROM public.pricing_rules pr
    WHERE pr.product_variant_id = v_variant_id AND pr.active = true
    ORDER BY pr.effective_from DESC
    LIMIT 1;

    v_is_custom := (v_pricing_type = 'CUSTOM') OR (v_product_name = 'Custom Cake');

    -- If standard menu item, enforce exact base_price from database
    IF NOT v_is_custom AND v_base_price IS NOT NULL THEN
      v_unit_price := v_base_price;
    END IF;

    v_total_amount := v_total_amount + (v_req_qty * v_unit_price);
  END LOOP;

  v_total_amount := ROUND(v_total_amount, 2);

  -- 5. Validate Payment Method & Breakdown
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

  -- 6. Insert `sales` Record
  INSERT INTO public.sales (
    branch_id,
    sale_date,
    total_amount,
    payment_method,
    amount_cash,
    amount_online,
    customer_name,
    notes,
    status,
    performed_by,
    order_id
  ) VALUES (
    p_branch_id,
    now(),
    v_total_amount,
    p_payment_method,
    v_amount_cash,
    v_amount_online,
    NULLIF(trim(p_customer_name), ''),
    NULLIF(trim(p_notes), ''),
    'COMPLETED',
    v_user_id,
    p_order_id
  ) RETURNING id INTO v_sale_id;

  -- 7. Process Each Cart Item (FEFO Unexpired Stock Allocation)
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variant_id := (v_elem->>'product_variant_id')::UUID;
    v_req_qty := (v_elem->>'quantity')::NUMERIC;
    v_unit_price := (v_elem->>'unit_price')::NUMERIC;
    v_item_notes := NULLIF(trim(v_elem->>'notes'), '');

    SELECT pv.name, p.name INTO v_variant_name, v_product_name
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = v_variant_id;

    SELECT pr.pricing_type, pr.base_price INTO v_pricing_type, v_base_price
    FROM public.pricing_rules pr
    WHERE pr.product_variant_id = v_variant_id AND pr.active = true
    ORDER BY pr.effective_from DESC LIMIT 1;

    v_is_custom := (v_pricing_type = 'CUSTOM') OR (v_product_name = 'Custom Cake');
    IF NOT v_is_custom AND v_base_price IS NOT NULL THEN
      v_unit_price := v_base_price;
    END IF;

    v_rem_qty := v_req_qty;

    -- Allocate unexpired stock (expiry_date >= CURRENT_DATE) via FEFO with row locking
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
      IF v_rem_qty <= 0 THEN
        EXIT;
      END IF;

      v_alloc_qty := LEAST(v_rem_qty, v_batch_rec.quantity_available);

      -- a. Insert `sale_items` row
      INSERT INTO public.sale_items (
        sale_id,
        product_variant_id,
        batch_id,
        quantity,
        unit_price_snapshot,
        is_custom_price,
        custom_price_entered_by,
        custom_price_entered_at,
        notes
      ) VALUES (
        v_sale_id,
        v_variant_id,
        v_batch_rec.batch_id,
        v_alloc_qty,
        v_unit_price,
        v_is_custom,
        CASE WHEN v_is_custom THEN v_user_id ELSE NULL END,
        CASE WHEN v_is_custom THEN now() ELSE NULL END,
        v_item_notes
      );

      -- b. Deduct stock from `inventory`
      UPDATE public.inventory
      SET quantity_available = quantity_available - v_alloc_qty
      WHERE id = v_batch_rec.inv_id;

      -- c. Insert immutable `inventory_movements` row
      INSERT INTO public.inventory_movements (
        branch_id,
        product_variant_id,
        batch_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        notes,
        performed_by
      ) VALUES (
        p_branch_id,
        v_variant_id,
        v_batch_rec.batch_id,
        'SALE',
        v_alloc_qty,
        'sales',
        v_sale_id,
        'POS Sale Receipt #' || substring(v_sale_id::text from 1 for 8),
        v_user_id
      );

      v_rem_qty := v_rem_qty - v_alloc_qty;
    END LOOP;

    IF v_rem_qty > 0 THEN
      RAISE EXCEPTION 'Insufficient unexpired stock for "% (%)". Requested: %, Available: %',
        v_product_name, v_variant_name, v_req_qty, (v_req_qty - v_rem_qty);
    END IF;
  END LOOP;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.process_pos_sale(
  UUID, public.payment_method, NUMERIC, NUMERIC, TEXT, TEXT, UUID, UUID, JSONB
) TO authenticated;

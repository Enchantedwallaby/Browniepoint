-- Main Branch sales do not use inventory. Sub-branch sales keep the existing
-- FEFO allocation and deduction path in process_pos_sale.
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

    v_is_custom := (v_pricing_type = 'CUSTOM') OR (v_product_name = 'Custom Cake');
    IF NOT v_is_custom AND v_base_price IS NOT NULL THEN
      v_unit_price := v_base_price;
    END IF;
    v_total_amount := v_total_amount + (v_req_qty * v_unit_price);
  END LOOP;

  v_total_amount := ROUND(v_total_amount, 2);

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

  INSERT INTO public.sales (
    branch_id, sale_date, total_amount, payment_method, amount_cash, amount_online,
    customer_name, notes, status, performed_by, order_id
  ) VALUES (
    p_branch_id, now(), v_total_amount, p_payment_method, v_amount_cash, v_amount_online,
    NULLIF(trim(p_customer_name), ''), NULLIF(trim(p_notes), ''), 'COMPLETED', v_user_id, p_order_id
  ) RETURNING id INTO v_sale_id;

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

    IF v_branch_type = 'MAIN' THEN
      INSERT INTO public.sale_items (
        sale_id, product_variant_id, batch_id, quantity, unit_price_snapshot,
        is_custom_price, custom_price_entered_by, custom_price_entered_at, notes
      ) VALUES (
        v_sale_id, v_variant_id, NULL, v_req_qty, v_unit_price, v_is_custom,
        CASE WHEN v_is_custom THEN v_user_id ELSE NULL END,
        CASE WHEN v_is_custom THEN now() ELSE NULL END, v_item_notes
      );
      CONTINUE;
    END IF;

    v_rem_qty := v_req_qty;
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
        is_custom_price, custom_price_entered_by, custom_price_entered_at, notes
      ) VALUES (
        v_sale_id, v_variant_id, v_batch_rec.batch_id, v_alloc_qty, v_unit_price,
        v_is_custom, CASE WHEN v_is_custom THEN v_user_id ELSE NULL END,
        CASE WHEN v_is_custom THEN now() ELSE NULL END, v_item_notes
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
        v_product_name, v_variant_name, v_req_qty, (v_req_qty - v_rem_qty);
    END IF;
  END LOOP;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.process_pos_sale(
  UUID, public.payment_method, NUMERIC, NUMERIC, TEXT, TEXT, UUID, UUID, JSONB
) TO authenticated;

-- Main Branch has no stock balance to allocate. This separate dispatch RPC
-- creates the transfer batch required by the existing sub-branch receipt flow.
CREATE OR REPLACE FUNCTION public.create_main_branch_stock_transfer(
  p_source_branch_id UUID,
  p_destination_branch_id UUID,
  p_notes TEXT,
  p_dispatched_by UUID,
  p_items JSONB
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

  v_transfer_number := 'TRF-' || to_char(now(), 'YYYYMMDD') || '-' ||
    upper(substring(gen_random_uuid()::text from 1 for 4));

  INSERT INTO public.stock_transfers (
    transfer_number, source_branch_id, destination_branch_id, status,
    dispatched_by, dispatched_at, notes
  ) VALUES (
    v_transfer_number, p_source_branch_id, p_destination_branch_id, 'IN_TRANSIT',
    v_user_id, now(), NULLIF(trim(p_notes), '')
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
      CURRENT_DATE,
      CURRENT_DATE + CASE
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

REVOKE ALL ON FUNCTION public.create_main_branch_stock_transfer(UUID, UUID, TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_main_branch_stock_transfer(UUID, UUID, TEXT, UUID, JSONB) TO authenticated;

-- Sub-branch return deductions and audit movements are unchanged. Returns to
-- Main remain in the movement audit trail but do not create a stock balance.
CREATE OR REPLACE FUNCTION public.review_return_request(
  p_return_id UUID,
  p_approve BOOLEAN,
  p_rejection_reason TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role public.user_role;
  v_request public.return_requests%ROWTYPE;
  v_inventory_id UUID;
  v_main_branch_id UUID;
  v_movement_type public.inventory_movement_type;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to review return requests.';
  END IF;

  v_role := public.get_auth_role();
  IF NOT COALESCE(public.is_owner(), false)
    AND v_role IS DISTINCT FROM 'MAIN_BRANCH_EMPLOYEE'::public.user_role THEN
    RAISE EXCEPTION 'Only the Owner or Main Branch employees can review return requests.';
  END IF;

  IF p_approve IS NULL THEN
    RAISE EXCEPTION 'A review decision is required.';
  END IF;

  SELECT * INTO v_request
  FROM public.return_requests
  WHERE id = p_return_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Return request not found.';
  END IF;

  IF v_request.created_by = v_user_id THEN
    RAISE EXCEPTION 'You cannot review your own return request.';
  END IF;

  IF v_request.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Only pending return requests can be reviewed.';
  END IF;

  IF NOT p_approve THEN
    IF NULLIF(trim(p_rejection_reason), '') IS NULL THEN
      RAISE EXCEPTION 'A reason is required when rejecting a return request.';
    END IF;

    UPDATE public.return_requests
    SET status = 'REJECTED',
        rejection_reason = trim(p_rejection_reason),
        reviewed_by = v_user_id,
        reviewed_at = now()
    WHERE id = p_return_id;

    RETURN;
  END IF;

  UPDATE public.inventory
  SET quantity_available = quantity_available - v_request.quantity
  WHERE branch_id = v_request.branch_id
    AND product_variant_id = v_request.product_variant_id
    AND batch_id = v_request.batch_id
    AND quantity_available >= v_request.quantity
  RETURNING id INTO v_inventory_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient current inventory to approve this return request.';
  END IF;

  IF v_request.reason = 'RETURN_TO_MAIN' THEN
    SELECT id INTO v_main_branch_id
    FROM public.branches
    WHERE branch_type = 'MAIN' AND active = true
    ORDER BY created_at
    LIMIT 1;

    IF v_main_branch_id IS NULL THEN
      RAISE EXCEPTION 'An active Main Branch is not configured.';
    END IF;

    IF v_request.branch_id = v_main_branch_id THEN
      RAISE EXCEPTION 'Stock cannot be returned to the same Main Branch.';
    END IF;

    INSERT INTO public.inventory_movements (
      branch_id, product_variant_id, batch_id, movement_type, quantity,
      reference_type, reference_id, notes, performed_by
    ) VALUES (
      v_request.branch_id, v_request.product_variant_id, v_request.batch_id,
      'RETURN_OUT', v_request.quantity, 'return_requests', p_return_id,
      'Approved return to Main Branch', v_user_id
    ), (
      v_main_branch_id, v_request.product_variant_id, v_request.batch_id,
      'RETURN_IN', v_request.quantity, 'return_requests', p_return_id,
      'Approved return received from branch', v_user_id
    );
  ELSE
    v_movement_type := CASE v_request.reason
      WHEN 'EXPIRED' THEN 'EXPIRED'::public.inventory_movement_type
      WHEN 'DAMAGED' THEN 'DAMAGED'::public.inventory_movement_type
      ELSE 'ADJUSTMENT'::public.inventory_movement_type
    END;

    INSERT INTO public.inventory_movements (
      branch_id, product_variant_id, batch_id, movement_type, quantity,
      reference_type, reference_id, notes, performed_by
    ) VALUES (
      v_request.branch_id, v_request.product_variant_id, v_request.batch_id,
      v_movement_type, v_request.quantity, 'return_requests', p_return_id,
      COALESCE(NULLIF(trim(v_request.notes), ''), 'Approved ' || lower(v_request.reason::TEXT) || ' stock adjustment'),
      v_user_id
    );
  END IF;

  UPDATE public.return_requests
  SET status = 'APPROVED',
      rejection_reason = NULL,
      reviewed_by = v_user_id,
      reviewed_at = now()
  WHERE id = p_return_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.review_return_request(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_return_request(UUID, BOOLEAN, TEXT) TO authenticated;

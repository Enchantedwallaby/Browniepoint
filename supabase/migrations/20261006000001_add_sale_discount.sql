ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0
  CHECK (discount_amount >= 0);

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
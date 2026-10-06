-- Return and stock adjustment workflow.

DO $$ BEGIN
  CREATE TYPE public.return_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.return_reason AS ENUM (
    'RETURN_TO_MAIN',
    'EXPIRED',
    'DAMAGED',
    'ADJUSTMENT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  batch_id UUID NOT NULL REFERENCES public.product_batches(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  reason public.return_reason NOT NULL,
  notes TEXT,
  status public.return_status NOT NULL DEFAULT 'PENDING',
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_return_rejection_reason CHECK (
    status <> 'REJECTED' OR NULLIF(trim(rejection_reason), '') IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_return_requests_branch_created
  ON public.return_requests(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_return_requests_status_created
  ON public.return_requests(status, created_at DESC);

ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "return_requests_select"
  ON public.return_requests FOR SELECT TO authenticated
  USING (
    public.is_owner() OR
    public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' OR
    branch_id = public.get_auth_branch_id()
  );

GRANT SELECT ON public.return_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.create_return_request(
  p_product_variant_id UUID,
  p_batch_id UUID,
  p_quantity NUMERIC,
  p_reason public.return_reason,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_branch_id UUID;
  v_available NUMERIC;
  v_return_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to submit a return request.';
  END IF;

  IF public.get_auth_role() IS DISTINCT FROM 'BRANCH_EMPLOYEE'::public.user_role THEN
    RAISE EXCEPTION 'Only branch employees can submit return requests.';
  END IF;

  SELECT p.branch_id INTO v_branch_id
  FROM public.profiles p
  WHERE p.id = v_user_id AND p.active = true;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'Your profile does not have an assigned branch.';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Return quantity must be a finite number greater than zero.';
  END IF;

  SELECT i.quantity_available INTO v_available
  FROM public.inventory i
  JOIN public.product_batches pb
    ON pb.id = i.batch_id AND pb.product_variant_id = i.product_variant_id
  WHERE i.branch_id = v_branch_id
    AND i.product_variant_id = p_product_variant_id
    AND i.batch_id = p_batch_id
  FOR UPDATE OF i;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected product batch is not available at your branch.';
  END IF;

  IF p_quantity > v_available THEN
    RAISE EXCEPTION 'Requested quantity (%) exceeds the available branch quantity (%).', p_quantity, v_available;
  END IF;

  INSERT INTO public.return_requests (
    branch_id, created_by, product_variant_id, batch_id, quantity, reason, notes
  ) VALUES (
    v_branch_id,
    v_user_id,
    p_product_variant_id,
    p_batch_id,
    p_quantity,
    p_reason,
    NULLIF(trim(p_notes), '')
  ) RETURNING id INTO v_return_id;

  RETURN v_return_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

    INSERT INTO public.inventory (
      branch_id, product_variant_id, batch_id, quantity_available, quantity_in_transit
    ) VALUES (
      v_main_branch_id, v_request.product_variant_id, v_request.batch_id, v_request.quantity, 0
    )
    ON CONFLICT (branch_id, product_variant_id, batch_id)
    DO UPDATE SET quantity_available = public.inventory.quantity_available + EXCLUDED.quantity_available;

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

REVOKE ALL ON FUNCTION public.create_return_request(UUID, UUID, NUMERIC, public.return_reason, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_return_request(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_return_request(UUID, UUID, NUMERIC, public.return_reason, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_return_request(UUID, BOOLEAN, TEXT) TO authenticated;
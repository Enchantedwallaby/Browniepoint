DO $$ BEGIN
  CREATE TYPE public.main_branch_spoilage_reason AS ENUM (
    'SPOILED',
    'DAMAGED',
    'EXPIRED',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE public.main_branch_spoilage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  reason public.main_branch_spoilage_reason NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  recorded_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_main_branch_spoilage_records_branch_created
  ON public.main_branch_spoilage_records(branch_id, created_at DESC);

ALTER TABLE public.main_branch_spoilage_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "main_branch_spoilage_records_select"
  ON public.main_branch_spoilage_records FOR SELECT TO authenticated
  USING (
    public.is_owner() OR (
      public.get_auth_role() = 'MAIN_BRANCH_EMPLOYEE' AND
      branch_id = public.get_auth_branch_id() AND
      EXISTS (
        SELECT 1
        FROM public.branches
        WHERE id = branch_id AND branch_type = 'MAIN' AND active = true
      )
    )
  );

GRANT SELECT ON public.main_branch_spoilage_records TO authenticated;

CREATE OR REPLACE FUNCTION public.record_main_branch_spoilage(
  p_product_variant_id UUID,
  p_quantity NUMERIC,
  p_reason public.main_branch_spoilage_reason,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_branch_id UUID;
  v_recorded_by_name TEXT;
  v_spoilage_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to record Main Branch spoilage.';
  END IF;

  IF public.get_auth_role() IS DISTINCT FROM 'MAIN_BRANCH_EMPLOYEE'::public.user_role THEN
    RAISE EXCEPTION 'Only Main Branch employees can record Main Branch spoilage.';
  END IF;

  SELECT p.branch_id, p.full_name
  INTO v_branch_id, v_recorded_by_name
  FROM public.profiles p
  WHERE p.id = v_user_id AND p.active = true;

  IF v_branch_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.branches b
    WHERE b.id = v_branch_id AND b.branch_type = 'MAIN' AND b.active = true
  ) THEN
    RAISE EXCEPTION 'Your profile must be assigned to an active Main Branch.';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0
    OR p_quantity::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Spoilage quantity must be a finite number greater than zero.';
  END IF;

  IF p_reason IS NULL THEN
    RAISE EXCEPTION 'A spoilage reason is required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = p_product_variant_id AND pv.active = true AND p.active = true
  ) THEN
    RAISE EXCEPTION 'The selected product variant is inactive or does not exist.';
  END IF;

  INSERT INTO public.main_branch_spoilage_records (
    branch_id, product_variant_id, quantity, reason, notes, created_by, recorded_by_name
  ) VALUES (
    v_branch_id,
    p_product_variant_id,
    p_quantity,
    p_reason,
    NULLIF(trim(p_notes), ''),
    v_user_id,
    v_recorded_by_name
  ) RETURNING id INTO v_spoilage_id;

  RETURN v_spoilage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.record_main_branch_spoilage(
  UUID, NUMERIC, public.main_branch_spoilage_reason, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_main_branch_spoilage(
  UUID, NUMERIC, public.main_branch_spoilage_reason, TEXT
) TO authenticated;

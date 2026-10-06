CREATE TABLE IF NOT EXISTS public.employee_access_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('ACCESS_REMOVED', 'ACCESS_RESTORED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_access_events_created_at
  ON public.employee_access_events(created_at DESC);

ALTER TABLE public.employee_access_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.employee_access_events FROM anon, authenticated;
GRANT SELECT ON TABLE public.employee_access_events TO authenticated;
GRANT ALL ON TABLE public.employee_access_events TO service_role;

DROP POLICY IF EXISTS "employee_access_events_select_owner" ON public.employee_access_events;
CREATE POLICY "employee_access_events_select_owner"
  ON public.employee_access_events FOR SELECT TO authenticated
  USING (public.is_owner());

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_owner())
  WITH CHECK (
    public.is_owner() OR (
      id = auth.uid() AND
      role = public.get_auth_role() AND
      (branch_id IS NOT DISTINCT FROM public.get_auth_branch_id()) AND
      active = true
    )
  );
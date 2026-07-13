-- Accès entreprise + demandes de sous-traitance

ALTER TYPE public.project_role ADD VALUE IF NOT EXISTS 'entreprise';

ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS enterprise_id UUID REFERENCES public.enterprises(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS project_members_enterprise_id_idx
  ON public.project_members(enterprise_id);

CREATE TABLE IF NOT EXISTS public.sous_traitance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  enterprise_id UUID NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('demande_sous_traitance', 'choix_travaux')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'soumise'
    CHECK (status IN ('brouillon', 'soumise', 'en_revision', 'acceptee', 'refusee')),
  deadline DATE,
  amount_ht NUMERIC(14, 2),
  reference TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sous_traitance_requests_project_id_idx
  ON public.sous_traitance_requests(project_id);
CREATE INDEX IF NOT EXISTS sous_traitance_requests_enterprise_id_idx
  ON public.sous_traitance_requests(enterprise_id);

DROP TRIGGER IF EXISTS sous_traitance_requests_updated_at ON public.sous_traitance_requests;
CREATE TRIGGER sous_traitance_requests_updated_at
  BEFORE UPDATE ON public.sous_traitance_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION public.user_enterprise_id_for_project(p_project_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT enterprise_id FROM public.project_members
  WHERE project_id = p_project_id
    AND user_id = auth.uid()
    AND role = 'entreprise'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_is_enterprise_on_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_enterprise_id_for_project(p_project_id) IS NOT NULL;
$$;

ALTER TABLE public.sous_traitance_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sous_traitance_select" ON public.sous_traitance_requests;
CREATE POLICY "sous_traitance_select" ON public.sous_traitance_requests
  FOR SELECT USING (
    public.user_can_manage_project(project_id)
    OR (
      public.user_is_enterprise_on_project(project_id)
      AND enterprise_id = public.user_enterprise_id_for_project(project_id)
    )
  );

DROP POLICY IF EXISTS "sous_traitance_insert" ON public.sous_traitance_requests;
CREATE POLICY "sous_traitance_insert" ON public.sous_traitance_requests
  FOR INSERT WITH CHECK (
    public.user_can_manage_project(project_id)
    OR (
      public.user_is_enterprise_on_project(project_id)
      AND enterprise_id = public.user_enterprise_id_for_project(project_id)
    )
  );

DROP POLICY IF EXISTS "sous_traitance_update" ON public.sous_traitance_requests;
CREATE POLICY "sous_traitance_update" ON public.sous_traitance_requests
  FOR UPDATE USING (
    public.user_can_manage_project(project_id)
    OR (
      public.user_is_enterprise_on_project(project_id)
      AND enterprise_id = public.user_enterprise_id_for_project(project_id)
      AND status IN ('brouillon', 'soumise')
    )
  )
  WITH CHECK (
    public.user_can_manage_project(project_id)
    OR (
      public.user_is_enterprise_on_project(project_id)
      AND enterprise_id = public.user_enterprise_id_for_project(project_id)
    )
  );

DROP POLICY IF EXISTS "sous_traitance_delete" ON public.sous_traitance_requests;
CREATE POLICY "sous_traitance_delete" ON public.sous_traitance_requests
  FOR DELETE USING (public.user_can_manage_project(project_id));

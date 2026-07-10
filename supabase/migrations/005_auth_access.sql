-- Phase 8 : authentification et contrôle d'accès par projet
-- Exécuter dans l'éditeur SQL Supabase (après les migrations 001 à 004)

-- Rôles globaux : super_admin voit tout ; user = accès via project_members
CREATE TYPE public.global_role AS ENUM ('super_admin', 'user');

-- Rôles par projet
CREATE TYPE public.project_role AS ENUM (
  'admin',       -- tout + gestion des membres
  'gestionnaire',-- édition complète (hors membres)
  'financier',   -- lecture + module finance
  'terrain',     -- visites, plans, checklist
  'lecture'      -- lecture seule
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  global_role public.global_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.project_role NOT NULL DEFAULT 'lecture',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_members_project_id_idx ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS project_members_user_id_idx ON public.project_members(user_id);

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Profil auto à l'inscription (1er utilisateur = super_admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role public.global_role;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE global_role = 'super_admin') THEN
    assigned_role := 'user';
  ELSE
    assigned_role := 'super_admin';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, global_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    assigned_role
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Helpers RLS
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND global_role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_project_role(p_project_id UUID)
RETURNS public.project_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.project_members
  WHERE project_id = p_project_id AND user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = p_project_id AND user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR public.user_project_role(p_project_id) IN ('admin', 'gestionnaire');
$$;

CREATE OR REPLACE FUNCTION public.user_can_edit_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_can_manage_project(p_project_id);
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_finance(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR public.user_project_role(p_project_id) IN ('admin', 'gestionnaire', 'financier');
$$;

CREATE OR REPLACE FUNCTION public.user_can_edit_finance(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR public.user_project_role(p_project_id) IN ('admin', 'gestionnaire', 'financier');
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_field(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR public.user_project_role(p_project_id) IN ('admin', 'gestionnaire', 'terrain');
$$;

CREATE OR REPLACE FUNCTION public.user_can_edit_field(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR public.user_project_role(p_project_id) IN ('admin', 'gestionnaire', 'terrain');
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_members(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR public.user_project_role(p_project_id) = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.enterprise_project_id(p_enterprise_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT project_id FROM public.enterprises WHERE id = p_enterprise_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.plan_project_id(p_plan_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT project_id FROM public.plans WHERE id = p_plan_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.visit_project_id(p_visit_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT project_id FROM public.visits WHERE id = p_visit_id LIMIT 1;
$$;

-- RLS profiles & project_members
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "members_select" ON public.project_members;
CREATE POLICY "members_select" ON public.project_members
  FOR SELECT USING (public.user_can_access_project(project_id));

DROP POLICY IF EXISTS "members_insert" ON public.project_members;
CREATE POLICY "members_insert" ON public.project_members
  FOR INSERT WITH CHECK (public.user_can_manage_members(project_id));

DROP POLICY IF EXISTS "members_update" ON public.project_members;
CREATE POLICY "members_update" ON public.project_members
  FOR UPDATE USING (public.user_can_manage_members(project_id))
  WITH CHECK (public.user_can_manage_members(project_id));

DROP POLICY IF EXISTS "members_delete" ON public.project_members;
CREATE POLICY "members_delete" ON public.project_members
  FOR DELETE USING (public.user_can_manage_members(project_id));

-- Projects
DROP POLICY IF EXISTS "Allow all on projects" ON public.projects;
DROP POLICY IF EXISTS "projects_select" ON public.projects;
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
DROP POLICY IF EXISTS "projects_update" ON public.projects;
DROP POLICY IF EXISTS "projects_delete" ON public.projects;

CREATE POLICY "projects_select" ON public.projects
  FOR SELECT USING (public.user_can_access_project(id));

CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE USING (public.user_can_edit_project(id))
  WITH CHECK (public.user_can_edit_project(id));

CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE USING (public.user_can_manage_members(id));

-- Enterprises
DROP POLICY IF EXISTS "Allow all on enterprises" ON public.enterprises;
DROP POLICY IF EXISTS "enterprises_all" ON public.enterprises;

CREATE POLICY "enterprises_select" ON public.enterprises
  FOR SELECT USING (public.user_can_access_project(project_id));

CREATE POLICY "enterprises_insert" ON public.enterprises
  FOR INSERT WITH CHECK (public.user_can_edit_project(project_id));

CREATE POLICY "enterprises_update" ON public.enterprises
  FOR UPDATE USING (public.user_can_edit_project(project_id))
  WITH CHECK (public.user_can_edit_project(project_id));

CREATE POLICY "enterprises_delete" ON public.enterprises
  FOR DELETE USING (public.user_can_edit_project(project_id));

-- Plans
DROP POLICY IF EXISTS "Allow all on plans" ON public.plans;
DROP POLICY IF EXISTS "plans_all" ON public.plans;

CREATE POLICY "plans_select" ON public.plans
  FOR SELECT USING (public.user_can_access_project(project_id));

CREATE POLICY "plans_insert" ON public.plans
  FOR INSERT WITH CHECK (public.user_can_edit_field(project_id));

CREATE POLICY "plans_update" ON public.plans
  FOR UPDATE USING (public.user_can_edit_field(project_id))
  WITH CHECK (public.user_can_edit_field(project_id));

CREATE POLICY "plans_delete" ON public.plans
  FOR DELETE USING (public.user_can_edit_field(project_id));

-- Visits
DROP POLICY IF EXISTS "Allow all on visits" ON public.visits;
DROP POLICY IF EXISTS "visits_all" ON public.visits;

CREATE POLICY "visits_select" ON public.visits
  FOR SELECT USING (public.user_can_access_project(project_id));

CREATE POLICY "visits_insert" ON public.visits
  FOR INSERT WITH CHECK (public.user_can_edit_field(project_id));

CREATE POLICY "visits_update" ON public.visits
  FOR UPDATE USING (public.user_can_edit_field(project_id))
  WITH CHECK (public.user_can_edit_field(project_id));

CREATE POLICY "visits_delete" ON public.visits
  FOR DELETE USING (public.user_can_edit_field(project_id));

-- Markers
DROP POLICY IF EXISTS "Allow all on markers" ON public.markers;
DROP POLICY IF EXISTS "markers_all" ON public.markers;

CREATE POLICY "markers_select" ON public.markers
  FOR SELECT USING (public.user_can_access_field(public.visit_project_id(visit_id)));

CREATE POLICY "markers_insert" ON public.markers
  FOR INSERT WITH CHECK (public.user_can_edit_field(public.visit_project_id(visit_id)));

CREATE POLICY "markers_update" ON public.markers
  FOR UPDATE USING (public.user_can_edit_field(public.visit_project_id(visit_id)))
  WITH CHECK (public.user_can_edit_field(public.visit_project_id(visit_id)));

CREATE POLICY "markers_delete" ON public.markers
  FOR DELETE USING (public.user_can_edit_field(public.visit_project_id(visit_id)));

-- Marker links
DROP POLICY IF EXISTS "Allow all on marker_links" ON public.marker_links;
DROP POLICY IF EXISTS "marker_links_all" ON public.marker_links;

CREATE POLICY "marker_links_select" ON public.marker_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.markers m
      WHERE m.id = from_marker_id
        AND public.user_can_access_field(public.visit_project_id(m.visit_id))
    )
  );

CREATE POLICY "marker_links_insert" ON public.marker_links
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.markers m
      WHERE m.id = from_marker_id
        AND public.user_can_edit_field(public.visit_project_id(m.visit_id))
    )
  );

CREATE POLICY "marker_links_delete" ON public.marker_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.markers m
      WHERE m.id = from_marker_id
        AND public.user_can_edit_field(public.visit_project_id(m.visit_id))
    )
  );

-- Finance tables (via enterprise -> project)
DROP POLICY IF EXISTS "Allow all on financial_amendments" ON public.financial_amendments;
DROP POLICY IF EXISTS "Allow all on financial_situations" ON public.financial_situations;
DROP POLICY IF EXISTS "Allow all on financial_situation_delegations" ON public.financial_situation_delegations;
DROP POLICY IF EXISTS "Allow all on financial_audit_log" ON public.financial_audit_log;
DROP POLICY IF EXISTS "Allow all on financial_bank_guarantees" ON public.financial_bank_guarantees;

CREATE POLICY "financial_amendments_select" ON public.financial_amendments
  FOR SELECT USING (public.user_can_access_finance(public.enterprise_project_id(enterprise_id)));

CREATE POLICY "financial_amendments_write" ON public.financial_amendments
  FOR ALL USING (public.user_can_edit_finance(public.enterprise_project_id(enterprise_id)))
  WITH CHECK (public.user_can_edit_finance(public.enterprise_project_id(enterprise_id)));

CREATE POLICY "financial_situations_select" ON public.financial_situations
  FOR SELECT USING (public.user_can_access_finance(public.enterprise_project_id(enterprise_id)));

CREATE POLICY "financial_situations_write" ON public.financial_situations
  FOR ALL USING (public.user_can_edit_finance(public.enterprise_project_id(enterprise_id)))
  WITH CHECK (public.user_can_edit_finance(public.enterprise_project_id(enterprise_id)));

CREATE POLICY "financial_delegations_select" ON public.financial_situation_delegations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.financial_situations s
      WHERE s.id = situation_id
        AND public.user_can_access_finance(public.enterprise_project_id(s.enterprise_id))
    )
  );

CREATE POLICY "financial_delegations_write" ON public.financial_situation_delegations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.financial_situations s
      WHERE s.id = situation_id
        AND public.user_can_edit_finance(public.enterprise_project_id(s.enterprise_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.financial_situations s
      WHERE s.id = situation_id
        AND public.user_can_edit_finance(public.enterprise_project_id(s.enterprise_id))
    )
  );

CREATE POLICY "financial_audit_log_select" ON public.financial_audit_log
  FOR SELECT USING (public.user_can_access_finance(project_id));

CREATE POLICY "financial_audit_log_insert" ON public.financial_audit_log
  FOR INSERT WITH CHECK (public.user_can_edit_finance(project_id));

CREATE POLICY "financial_bank_guarantees_select" ON public.financial_bank_guarantees
  FOR SELECT USING (public.user_can_access_finance(project_id));

CREATE POLICY "financial_bank_guarantees_write" ON public.financial_bank_guarantees
  FOR ALL USING (public.user_can_edit_finance(project_id))
  WITH CHECK (public.user_can_edit_finance(project_id));

-- Storage : authentification requise + accès projet via 1er segment du chemin
DROP POLICY IF EXISTS "Allow all plans storage" ON storage.objects;
DROP POLICY IF EXISTS "Allow all visit photos storage" ON storage.objects;
DROP POLICY IF EXISTS "Public read financial-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow upload financial-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete financial-files" ON storage.objects;

CREATE POLICY "plans_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'plans' AND auth.uid() IS NOT NULL
    AND public.user_can_access_project((split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "plans_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'plans' AND auth.uid() IS NOT NULL
    AND public.user_can_edit_field((split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "plans_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'plans' AND auth.uid() IS NOT NULL
    AND public.user_can_edit_field((split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "visit_photos_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'visit-photos' AND auth.uid() IS NOT NULL
    AND public.user_can_access_field((split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "visit_photos_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'visit-photos' AND auth.uid() IS NOT NULL
    AND public.user_can_edit_field((split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "visit_photos_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'visit-photos' AND auth.uid() IS NOT NULL
    AND public.user_can_edit_field((split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "financial_files_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'financial-files' AND auth.uid() IS NOT NULL
    AND public.user_can_access_finance((split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "financial_files_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'financial-files' AND auth.uid() IS NOT NULL
    AND public.user_can_edit_finance((split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "financial_files_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'financial-files' AND auth.uid() IS NOT NULL
    AND public.user_can_edit_finance((split_part(name, '/', 1))::uuid)
  );

-- Accès existants : le super_admin voit tout ; pour les projets sans membres,
-- exécutez manuellement (remplacez USER_UUID) :
-- INSERT INTO project_members (project_id, user_id, role)
-- SELECT id, 'USER_UUID', 'admin' FROM projects;

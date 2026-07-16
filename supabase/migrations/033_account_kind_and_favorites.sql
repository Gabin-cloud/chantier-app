-- Comptes DANOBAT (PC + tablette) vs comptes entreprise (portail uniquement)
-- + favoris projets personnels (partagés PC / tablette)

DO $$ BEGIN
  CREATE TYPE public.account_kind AS ENUM ('danobat', 'entreprise');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_kind public.account_kind NOT NULL DEFAULT 'danobat';

COMMENT ON COLUMN public.profiles.account_kind IS
  'danobat = interfaces PC/tablette ; entreprise = portail entreprise uniquement';

-- Backfill : comptes qui n'ont que des accès « entreprise » → entreprise
UPDATE public.profiles p
SET account_kind = 'entreprise'
WHERE p.global_role <> 'super_admin'
  AND EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.user_id = p.id AND pm.role = 'entreprise'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.user_id = p.id AND pm.role <> 'entreprise'
  );

-- Nouveaux inscrits = DANOBAT par défaut
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

  INSERT INTO public.profiles (id, email, full_name, global_role, account_kind)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    assigned_role,
    CASE
      WHEN NEW.raw_user_meta_data->>'account_kind' = 'entreprise'
        THEN 'entreprise'::public.account_kind
      ELSE 'danobat'::public.account_kind
    END
  );

  RETURN NEW;
END;
$$;

-- Favoris personnels
CREATE TABLE IF NOT EXISTS public.project_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS project_favorites_user_id_idx
  ON public.project_favorites (user_id);
CREATE INDEX IF NOT EXISTS project_favorites_project_id_idx
  ON public.project_favorites (project_id);

ALTER TABLE public.project_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_favorites_select_own" ON public.project_favorites;
CREATE POLICY "project_favorites_select_own" ON public.project_favorites
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
    AND public.user_can_access_project(project_id)
  );

DROP POLICY IF EXISTS "project_favorites_insert_own" ON public.project_favorites;
CREATE POLICY "project_favorites_insert_own" ON public.project_favorites
  FOR INSERT WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.user_can_access_project(project_id)
  );

DROP POLICY IF EXISTS "project_favorites_delete_own" ON public.project_favorites;
CREATE POLICY "project_favorites_delete_own" ON public.project_favorites
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- Helper : type de compte courant (pour middleware / RLS futurs)
CREATE OR REPLACE FUNCTION public.current_account_kind()
RETURNS public.account_kind
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_kind FROM public.profiles WHERE id = (SELECT auth.uid())
$$;

REVOKE ALL ON FUNCTION public.current_account_kind() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_account_kind() TO authenticated;

-- Optimisation & durcissement (aucun changement d'expérience utilisateur)
-- 1) Index sur les clés étrangères non couvertes  -> performance des jointures/filtres
-- 2) search_path figé sur les fonctions            -> durcissement sécurité
-- 3) RLS "initplan" : (select auth.uid())          -> perf des policies à l'échelle
-- 4) REVOKE EXECUTE des fonctions SECURITY DEFINER  -> ferme l'exposition RPC anon

-- ----------------------------------------------------------------------------
-- 1) Index manquants sur clés étrangères
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS control_point_tracking_enterprise_id_idx
  ON public.control_point_tracking(enterprise_id);
CREATE INDEX IF NOT EXISTS control_point_tracking_visit_id_idx
  ON public.control_point_tracking(visit_id);
CREATE INDEX IF NOT EXISTS email_templates_updated_by_idx
  ON public.email_templates(updated_by);
CREATE INDEX IF NOT EXISTS financial_audit_log_enterprise_id_idx
  ON public.financial_audit_log(enterprise_id);
CREATE INDEX IF NOT EXISTS marker_links_to_marker_id_idx
  ON public.marker_links(to_marker_id);
CREATE INDEX IF NOT EXISTS markers_enterprise_id_idx
  ON public.markers(enterprise_id);
CREATE INDEX IF NOT EXISTS markers_location_preset_id_idx
  ON public.markers(location_preset_id);
CREATE INDEX IF NOT EXISTS phase_checklist_items_zone_id_idx
  ON public.phase_checklist_items(zone_id);
CREATE INDEX IF NOT EXISTS project_locations_created_by_idx
  ON public.project_locations(created_by);
CREATE INDEX IF NOT EXISTS sous_traitance_requests_created_by_idx
  ON public.sous_traitance_requests(created_by);
CREATE INDEX IF NOT EXISTS visit_checklist_responses_checklist_item_id_idx
  ON public.visit_checklist_responses(checklist_item_id);
CREATE INDEX IF NOT EXISTS visit_email_logs_visit_id_idx
  ON public.visit_email_logs(visit_id);
CREATE INDEX IF NOT EXISTS visits_checklist_item_id_idx
  ON public.visits(checklist_item_id);

-- ----------------------------------------------------------------------------
-- 2) search_path figé (durcissement) sur le trigger updated_at
-- ----------------------------------------------------------------------------
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- ----------------------------------------------------------------------------
-- 3) Optimisation RLS : évaluer auth.uid() une seule fois (même résultat)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = (select auth.uid()) OR public.is_super_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "projects_insert" ON public.projects;
CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 4) Fermer l'exposition RPC publique (role `anon`) des fonctions SECURITY DEFINER.
--    IMPORTANT : on garde `authenticated` car ces fonctions sont appelées DANS
--    les policies RLS (évaluées avec les droits de l'appelant). Retirer
--    `authenticated` casserait les policies. On ne retire donc que `anon`,
--    ce qui ferme l'accès via /rest/v1/rpc sans utilisateur connecté.
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_project_role(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_can_access_project(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_can_manage_project(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_can_edit_project(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_can_access_finance(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_can_edit_finance(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_can_access_field(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_can_edit_field(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_can_manage_members(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_enterprise_id_for_project(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enterprise_project_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.plan_project_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.visit_project_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.checklist_item_project_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_email_templates() FROM anon;

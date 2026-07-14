-- Ferme réellement l'exécution publique des fonctions SECURITY DEFINER.
-- La 023 révoquait `anon` seul, sans effet : le droit EXECUTE est accordé par
-- défaut à PUBLIC (dont `anon` hérite). On révoque donc PUBLIC puis on
-- ré-accorde explicitement `authenticated` (indispensable pour les policies RLS)
-- et `service_role` (client admin). Aucun changement pour l'utilisateur connecté.

DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.is_super_admin()',
    'public.user_project_role(uuid)',
    'public.user_can_access_project(uuid)',
    'public.user_can_manage_project(uuid)',
    'public.user_can_edit_project(uuid)',
    'public.user_can_access_finance(uuid)',
    'public.user_can_edit_finance(uuid)',
    'public.user_can_access_field(uuid)',
    'public.user_can_edit_field(uuid)',
    'public.user_can_manage_members(uuid)',
    'public.user_enterprise_id_for_project(uuid)',
    'public.enterprise_project_id(uuid)',
    'public.plan_project_id(uuid)',
    'public.visit_project_id(uuid)',
    'public.checklist_item_project_id(uuid)',
    'public.can_manage_email_templates()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC;', fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon;', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated;', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;', fn);
  END LOOP;
END $$;

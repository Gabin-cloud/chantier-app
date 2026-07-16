-- Les policies RLS évaluent souvent `OR public.is_super_admin()`.
-- PostgreSQL peut évaluer les deux côtés : si `anon` n'a pas EXECUTE,
-- la policy échoue avec 42501 (permission denied) au lieu de renvoyer false.
-- Les helpers renvoient false sans session — le GRANT à anon est sûr.

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_project(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.user_project_role(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.current_account_kind() TO anon;

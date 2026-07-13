-- Correction de "bulles" : tables avec RLS activé mais AUCUNE policy
-- (activation manuelle sur la base distante, jamais versionnée).
-- Résultat actuel : lectures/écritures via le client authentifié renvoient vide
-- ou échouent silencieusement. On rétablit le comportement prévu, de façon sûre.
--
-- Note : ajouter des policies là où il n'y en a aucune ne peut qu'AUTORISER
-- l'accès prévu ; cela ne retire aucun accès existant.

-- ----------------------------------------------------------------------------
-- control_library_items : bibliothèque GLOBALE de points de contrôle (sans projet)
--   - lecture : tout utilisateur connecté (pour importer dans un projet)
--   - écriture : super_admin uniquement (modèle partagé)
-- ----------------------------------------------------------------------------
ALTER TABLE public.control_library_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "control_library_items_select" ON public.control_library_items;
CREATE POLICY "control_library_items_select" ON public.control_library_items
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "control_library_items_write" ON public.control_library_items;
CREATE POLICY "control_library_items_write" ON public.control_library_items
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- phase_zones : zones par phase (rattachées à un projet via visit_phases)
--   - lecture : membres du projet
--   - écriture : rôles édition terrain (admin/gestionnaire/terrain)
-- ----------------------------------------------------------------------------
ALTER TABLE public.phase_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "phase_zones_select" ON public.phase_zones;
CREATE POLICY "phase_zones_select" ON public.phase_zones
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.visit_phases vp
      WHERE vp.id = phase_id
        AND public.user_can_access_project(vp.project_id)
    )
  );

DROP POLICY IF EXISTS "phase_zones_write" ON public.phase_zones;
CREATE POLICY "phase_zones_write" ON public.phase_zones
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.visit_phases vp
      WHERE vp.id = phase_id
        AND public.user_can_edit_field(vp.project_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.visit_phases vp
      WHERE vp.id = phase_id
        AND public.user_can_edit_field(vp.project_id)
    )
  );

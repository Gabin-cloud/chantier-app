-- Photos multiples par pastille + ordre des phases référentiel

CREATE TABLE IF NOT EXISTS public.marker_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marker_id UUID NOT NULL REFERENCES public.markers(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marker_photos_marker_id_idx ON public.marker_photos(marker_id);

ALTER TABLE public.marker_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marker_photos_select" ON public.marker_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.markers m
      JOIN public.visits v ON v.id = m.visit_id
      WHERE m.id = marker_photos.marker_id
        AND public.user_can_access_project(v.project_id)
    )
  );

CREATE POLICY "marker_photos_insert" ON public.marker_photos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.markers m
      JOIN public.visits v ON v.id = m.visit_id
      WHERE m.id = marker_photos.marker_id
        AND public.user_can_edit_project(v.project_id)
    )
  );

CREATE POLICY "marker_photos_delete" ON public.marker_photos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.markers m
      JOIN public.visits v ON v.id = m.visit_id
      WHERE m.id = marker_photos.marker_id
        AND public.user_can_edit_project(v.project_id)
    )
  );

-- Ordre des phases dans la bibliothèque globale
CREATE TABLE IF NOT EXISTS public.control_library_phase_order (
  phase_name TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.control_library_phase_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "control_library_phase_order_select" ON public.control_library_phase_order
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "control_library_phase_order_write" ON public.control_library_phase_order
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_kind IN ('owner', 'admin')
    )
  );

-- RLS pour rapports, logs email, suivi contrôles + mise à jour storage PDF

CREATE OR REPLACE FUNCTION public.checklist_item_project_id(p_item_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vp.project_id
  FROM public.phase_checklist_items pci
  JOIN public.visit_phases vp ON vp.id = pci.phase_id
  WHERE pci.id = p_item_id
  LIMIT 1;
$$;

-- visit_reports
ALTER TABLE public.visit_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visit_reports_select" ON public.visit_reports;
DROP POLICY IF EXISTS "visit_reports_insert" ON public.visit_reports;
DROP POLICY IF EXISTS "visit_reports_delete" ON public.visit_reports;

CREATE POLICY "visit_reports_select" ON public.visit_reports
  FOR SELECT USING (
    public.user_can_access_field(public.visit_project_id(visit_id))
  );

CREATE POLICY "visit_reports_insert" ON public.visit_reports
  FOR INSERT WITH CHECK (
    public.user_can_edit_field(public.visit_project_id(visit_id))
  );

CREATE POLICY "visit_reports_delete" ON public.visit_reports
  FOR DELETE USING (
    public.user_can_edit_field(public.visit_project_id(visit_id))
  );

-- visit_email_logs
ALTER TABLE public.visit_email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visit_email_logs_select" ON public.visit_email_logs;
DROP POLICY IF EXISTS "visit_email_logs_insert" ON public.visit_email_logs;

CREATE POLICY "visit_email_logs_select" ON public.visit_email_logs
  FOR SELECT USING (
    public.user_can_access_field(public.visit_project_id(visit_id))
  );

CREATE POLICY "visit_email_logs_insert" ON public.visit_email_logs
  FOR INSERT WITH CHECK (
    public.user_can_edit_field(public.visit_project_id(visit_id))
  );

-- control_point_tracking
ALTER TABLE public.control_point_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "control_point_tracking_select" ON public.control_point_tracking;
DROP POLICY IF EXISTS "control_point_tracking_insert" ON public.control_point_tracking;
DROP POLICY IF EXISTS "control_point_tracking_update" ON public.control_point_tracking;
DROP POLICY IF EXISTS "control_point_tracking_delete" ON public.control_point_tracking;

CREATE POLICY "control_point_tracking_select" ON public.control_point_tracking
  FOR SELECT USING (
    public.user_can_access_field(public.checklist_item_project_id(checklist_item_id))
  );

CREATE POLICY "control_point_tracking_insert" ON public.control_point_tracking
  FOR INSERT WITH CHECK (
    public.user_can_edit_project(public.checklist_item_project_id(checklist_item_id))
  );

CREATE POLICY "control_point_tracking_update" ON public.control_point_tracking
  FOR UPDATE USING (
    public.user_can_edit_project(public.checklist_item_project_id(checklist_item_id))
  )
  WITH CHECK (
    public.user_can_edit_project(public.checklist_item_project_id(checklist_item_id))
  );

CREATE POLICY "control_point_tracking_delete" ON public.control_point_tracking
  FOR DELETE USING (
    public.user_can_edit_project(public.checklist_item_project_id(checklist_item_id))
  );

-- Storage : autoriser la mise à jour (upsert PDF rapports)
DROP POLICY IF EXISTS "visit_photos_storage_update" ON storage.objects;

CREATE POLICY "visit_photos_storage_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'visit-photos' AND auth.uid() IS NOT NULL
    AND public.user_can_edit_field((split_part(name, '/', 1))::uuid)
  )
  WITH CHECK (
    bucket_id = 'visit-photos' AND auth.uid() IS NOT NULL
    AND public.user_can_edit_field((split_part(name, '/', 1))::uuid)
  );

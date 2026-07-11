-- Sprint 2 : réserves enrichies, localisations projet, dessins sur plans

CREATE TABLE IF NOT EXISTS project_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_preset BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, name)
);

CREATE INDEX IF NOT EXISTS project_locations_project_id_idx ON project_locations(project_id);

ALTER TABLE markers
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'a_traiter'
    CHECK (status IN ('a_traiter', 'en_cours', 'rejetee', 'levee', 'constat')),
  ADD COLUMN IF NOT EXISTS enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trade TEXT,
  ADD COLUMN IF NOT EXISTS location_label TEXT,
  ADD COLUMN IF NOT EXISTS location_preset_id UUID REFERENCES project_locations(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS plan_drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL DEFAULT 1,
  strokes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(visit_id, plan_id, page_number)
);

CREATE INDEX IF NOT EXISTS plan_drawings_visit_id_idx ON plan_drawings(visit_id);
CREATE INDEX IF NOT EXISTS plan_drawings_plan_id_idx ON plan_drawings(plan_id);

DROP TRIGGER IF EXISTS plan_drawings_updated_at ON plan_drawings;
CREATE TRIGGER plan_drawings_updated_at
  BEFORE UPDATE ON plan_drawings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE project_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_drawings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_locations_select" ON project_locations;
CREATE POLICY "project_locations_select" ON project_locations
  FOR SELECT USING (public.user_can_access_project(project_id));

DROP POLICY IF EXISTS "project_locations_insert" ON project_locations;
CREATE POLICY "project_locations_insert" ON project_locations
  FOR INSERT WITH CHECK (public.user_can_edit_field(project_id));

DROP POLICY IF EXISTS "project_locations_delete" ON project_locations;
CREATE POLICY "project_locations_delete" ON project_locations
  FOR DELETE USING (public.user_can_edit_field(project_id));

DROP POLICY IF EXISTS "plan_drawings_select" ON plan_drawings;
CREATE POLICY "plan_drawings_select" ON plan_drawings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM visits v
      WHERE v.id = plan_drawings.visit_id
        AND public.user_can_access_project(v.project_id)
    )
  );

DROP POLICY IF EXISTS "plan_drawings_insert" ON plan_drawings;
CREATE POLICY "plan_drawings_insert" ON plan_drawings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM visits v
      WHERE v.id = plan_drawings.visit_id
        AND public.user_can_edit_field(v.project_id)
    )
  );

DROP POLICY IF EXISTS "plan_drawings_update" ON plan_drawings;
CREATE POLICY "plan_drawings_update" ON plan_drawings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM visits v
      WHERE v.id = plan_drawings.visit_id
        AND public.user_can_edit_field(v.project_id)
    )
  );

DROP POLICY IF EXISTS "plan_drawings_delete" ON plan_drawings;
CREATE POLICY "plan_drawings_delete" ON plan_drawings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM visits v
      WHERE v.id = plan_drawings.visit_id
        AND public.user_can_edit_field(v.project_id)
    )
  );

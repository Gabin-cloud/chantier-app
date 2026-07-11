-- Sprint 3 : phases de visite, dossiers de plans, réserves partagées par phase
-- Exécuter dans l'éditeur SQL Supabase

CREATE TABLE IF NOT EXISTS visit_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS plan_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES plan_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES plan_folders(id) ON DELETE SET NULL;

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES visit_phases(id) ON DELETE RESTRICT;

ALTER TABLE markers
  ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES visit_phases(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS visit_phases_project_id_idx ON visit_phases(project_id);
CREATE INDEX IF NOT EXISTS plan_folders_project_id_idx ON plan_folders(project_id);
CREATE INDEX IF NOT EXISTS plan_folders_parent_id_idx ON plan_folders(parent_id);
CREATE INDEX IF NOT EXISTS plans_folder_id_idx ON plans(folder_id);
CREATE INDEX IF NOT EXISTS visits_phase_id_idx ON visits(phase_id);
CREATE INDEX IF NOT EXISTS markers_phase_id_idx ON markers(phase_id);

-- Phases par défaut pour chaque projet existant
INSERT INTO visit_phases (project_id, name, sort_order)
SELECT p.id, phase.name, phase.sort_order
FROM projects p
CROSS JOIN (
  VALUES
    ('Gros œuvre', 1),
    ('Second œuvre', 2),
    ('Livraison', 3)
) AS phase(name, sort_order)
ON CONFLICT (project_id, name) DO NOTHING;

-- Visites existantes → première phase du projet
UPDATE visits v
SET phase_id = (
  SELECT vp.id
  FROM visit_phases vp
  WHERE vp.project_id = v.project_id
  ORDER BY vp.sort_order, vp.created_at
  LIMIT 1
)
WHERE v.phase_id IS NULL;

-- Réserves existantes → phase de leur visite
UPDATE markers m
SET phase_id = v.phase_id
FROM visits v
WHERE m.visit_id = v.id
  AND m.phase_id IS NULL
  AND v.phase_id IS NOT NULL;

ALTER TABLE visit_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on visit_phases" ON visit_phases;
CREATE POLICY "Allow all on visit_phases" ON visit_phases
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on plan_folders" ON plan_folders;
CREATE POLICY "Allow all on plan_folders" ON plan_folders
  FOR ALL USING (true) WITH CHECK (true);

-- Points de contrôle par phase (préparation checklist terrain)
CREATE TABLE IF NOT EXISTS phase_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES visit_phases(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visit_checklist_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES phase_checklist_items(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ok', 'partial', 'ko')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (visit_id, checklist_item_id)
);

CREATE INDEX IF NOT EXISTS phase_checklist_items_phase_id_idx ON phase_checklist_items(phase_id);
CREATE INDEX IF NOT EXISTS visit_checklist_responses_visit_id_idx ON visit_checklist_responses(visit_id);

ALTER TABLE phase_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_checklist_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on phase_checklist_items" ON phase_checklist_items;
CREATE POLICY "Allow all on phase_checklist_items" ON phase_checklist_items
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on visit_checklist_responses" ON visit_checklist_responses;
CREATE POLICY "Allow all on visit_checklist_responses" ON visit_checklist_responses
  FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS visit_checklist_responses_updated_at ON visit_checklist_responses;
CREATE TRIGGER visit_checklist_responses_updated_at
  BEFORE UPDATE ON visit_checklist_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

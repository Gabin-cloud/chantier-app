-- Phase 2 : plans PDF, visites et pastilles
-- Exécuter dans l'éditeur SQL Supabase

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL DEFAULT 1,
  x_percent DOUBLE PRECISION NOT NULL CHECK (x_percent >= 0 AND x_percent <= 100),
  y_percent DOUBLE PRECISION NOT NULL CHECK (y_percent >= 0 AND y_percent <= 100),
  remark TEXT,
  photo_path TEXT,
  marker_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marker_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_marker_id UUID NOT NULL REFERENCES markers(id) ON DELETE CASCADE,
  to_marker_id UUID NOT NULL REFERENCES markers(id) ON DELETE CASCADE,
  UNIQUE(from_marker_id, to_marker_id),
  CHECK (from_marker_id <> to_marker_id)
);

CREATE INDEX IF NOT EXISTS plans_project_id_idx ON plans(project_id);
CREATE INDEX IF NOT EXISTS visits_project_id_idx ON visits(project_id);
CREATE INDEX IF NOT EXISTS markers_visit_id_idx ON markers(visit_id);
CREATE INDEX IF NOT EXISTS markers_plan_id_idx ON markers(plan_id);

DROP TRIGGER IF EXISTS visits_updated_at ON visits;
CREATE TRIGGER visits_updated_at
  BEFORE UPDATE ON visits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS markers_updated_at ON markers;
CREATE TRIGGER markers_updated_at
  BEFORE UPDATE ON markers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE marker_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on plans" ON plans;
CREATE POLICY "Allow all on plans" ON plans FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on visits" ON visits;
CREATE POLICY "Allow all on visits" ON visits FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on markers" ON markers;
CREATE POLICY "Allow all on markers" ON markers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on marker_links" ON marker_links;
CREATE POLICY "Allow all on marker_links" ON marker_links FOR ALL USING (true) WITH CHECK (true);

-- Buckets de stockage pour PDF et photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('plans', 'plans', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('visit-photos', 'visit-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow all plans storage" ON storage.objects;
CREATE POLICY "Allow all plans storage" ON storage.objects
  FOR ALL USING (bucket_id = 'plans') WITH CHECK (bucket_id = 'plans');

DROP POLICY IF EXISTS "Allow all visit photos storage" ON storage.objects;
CREATE POLICY "Allow all visit photos storage" ON storage.objects
  FOR ALL USING (bucket_id = 'visit-photos') WITH CHECK (bucket_id = 'visit-photos');

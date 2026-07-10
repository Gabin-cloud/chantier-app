-- Phase 1 : projets et entreprises
-- Exécuter ce script dans l'éditeur SQL de Supabase

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enterprises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trade TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS enterprises_project_id_idx ON enterprises(project_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on projects" ON projects;
CREATE POLICY "Allow all on projects" ON projects
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on enterprises" ON enterprises;
CREATE POLICY "Allow all on enterprises" ON enterprises
  FOR ALL USING (true) WITH CHECK (true);

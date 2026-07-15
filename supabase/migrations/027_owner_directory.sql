-- Annuaire maîtres d'ouvrage réutilisable (auto-remplissage fiche opération).

CREATE TABLE IF NOT EXISTS owner_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  email_admin TEXT,
  email_works TEXT,
  signatory_name TEXT,
  signatory_email TEXT,
  logo_path TEXT,
  doc_marche BOOLEAN NOT NULL DEFAULT FALSE,
  doc_os BOOLEAN NOT NULL DEFAULT FALSE,
  doc_ae BOOLEAN NOT NULL DEFAULT FALSE,
  doc_avenant BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS owner_directory_name_idx ON owner_directory (name);

DROP TRIGGER IF EXISTS owner_directory_updated_at ON owner_directory;
CREATE TRIGGER owner_directory_updated_at
  BEFORE UPDATE ON owner_directory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE owner_directory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_directory_select" ON owner_directory;
CREATE POLICY "owner_directory_select" ON owner_directory
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "owner_directory_write" ON owner_directory;
CREATE POLICY "owner_directory_write" ON owner_directory
  FOR ALL USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Alimenter l'annuaire depuis les opérations existantes.
INSERT INTO owner_directory (
  name, address, postal_code, city,
  email_admin, email_works,
  signatory_name, signatory_email,
  doc_marche, doc_os, doc_ae, doc_avenant
)
SELECT DISTINCT ON (owner_name)
  owner_name, owner_address, owner_postal_code, owner_city,
  owner_email_admin, owner_email_works,
  owner_signatory_name, owner_signatory_email,
  owner_doc_marche, owner_doc_os, owner_doc_ae, owner_doc_avenant
FROM projects
WHERE owner_name IS NOT NULL AND trim(owner_name) <> ''
ON CONFLICT (name) DO NOTHING;

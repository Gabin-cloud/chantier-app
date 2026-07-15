-- Fiche opération : page de configuration unique du projet.
-- Ajoute les champs Maître d'ouvrage / Maître d'œuvre au projet,
-- les champs entreprise détaillés (SIRET, emails, téléphones, signataire, logo),
-- et une base de données d'entreprises réutilisable (company_directory)
-- pour pré-remplir automatiquement les fiches au début des opérations.

-- ----------------------------------------------------------------------------
-- PROJETS : bloc Maître d'ouvrage (MOA) + Maître d'œuvre (MOE = DANOBAT)
-- Tous ces champs sont renseignés par DANOBAT.
-- ----------------------------------------------------------------------------
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_address TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_postal_code TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_city TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_email_admin TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_email_works TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_signatory_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_signatory_email TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_logo_path TEXT;

-- Documents types associés au maître d'ouvrage (déterminent les documents à produire)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_doc_marche BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_doc_os BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_doc_ae BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_doc_avenant BOOLEAN NOT NULL DEFAULT FALSE;

-- Maître d'œuvre (DANOBAT)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS moe_address TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS moe_postal_code TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS moe_city TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS moe_email_admin TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS moe_email_works TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS moe_logo_path TEXT;
-- Le lien serveur SharePoint réutilise la colonne existante sharepoint_plan_exe_path.

-- ----------------------------------------------------------------------------
-- ENTREPRISES : champs détaillés de la fiche
--   - name / lot_number / designation : renseignés par DANOBAT (déjà existants)
--   - adresse / emails / téléphones / signataire / SIRET / logo : par l'entreprise
--   - avancement_max_avant_dgd : par DANOBAT (pré-rempli 95 %)
-- ----------------------------------------------------------------------------
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS enterprise_postal_code TEXT;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS enterprise_city TEXT;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS email_comptabilite TEXT;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS email_travaux TEXT;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS email_bureau_etudes TEXT;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS email_signataire TEXT;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS signataire_name TEXT;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS siret TEXT;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS email_sav TEXT;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS phone_accueil TEXT;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS phone_travaux TEXT;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS logo_path TEXT;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS avancement_max_avant_dgd NUMERIC(5, 2) NOT NULL DEFAULT 95;

-- ----------------------------------------------------------------------------
-- COMPANY_DIRECTORY : base de données d'entreprises réutilisable
-- Renseignée au fil des opérations (par les entreprises ou DANOBAT) et clé
-- de SIRET pour pré-remplir automatiquement les nouvelles fiches.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siret TEXT UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  email_administratif TEXT,
  email_comptabilite TEXT,
  email_travaux TEXT,
  email_bureau_etudes TEXT,
  email_signataire TEXT,
  signataire_name TEXT,
  email_sav TEXT,
  phone_accueil TEXT,
  phone_travaux TEXT,
  logo_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS company_directory_name_idx ON company_directory (name);

DROP TRIGGER IF EXISTS company_directory_updated_at ON company_directory;
CREATE TRIGGER company_directory_updated_at
  BEFORE UPDATE ON company_directory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE company_directory ENABLE ROW LEVEL SECURITY;

-- Base partagée : lecture et écriture pour tout utilisateur connecté
-- (entreprises et DANOBAT alimentent l'annuaire).
DROP POLICY IF EXISTS "company_directory_select" ON company_directory;
CREATE POLICY "company_directory_select" ON company_directory
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "company_directory_write" ON company_directory;
CREATE POLICY "company_directory_write" ON company_directory
  FOR ALL USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ----------------------------------------------------------------------------
-- Bucket logos (réutilise le bucket public financial-files, sous-dossier logos/).
-- Rien à créer : les logos sont stockés dans financial-files/logos/.
-- ----------------------------------------------------------------------------

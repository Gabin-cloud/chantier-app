-- Phase 7b : améliorations suivi financier
-- Exécuter ce script dans l'éditeur SQL de Supabase

-- Photo de l'opération
ALTER TABLE projects ADD COLUMN IF NOT EXISTS operation_photo_path TEXT;

-- Cautions bancaires au niveau chantier (valeur fixe pour toute l'opération)
CREATE TABLE IF NOT EXISTS financial_bank_guarantees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  amount_ht NUMERIC(15, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS financial_bank_guarantees_project_id_idx
  ON financial_bank_guarantees(project_id);

-- E-mails entreprise + caution bancaire par lot
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS email_chantier TEXT;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS email_factures TEXT;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS email_administratif TEXT;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS has_bank_guarantee BOOLEAN DEFAULT FALSE;

-- Facture entreprise jointe à la situation
ALTER TABLE financial_situations ADD COLUMN IF NOT EXISTS invoice_file_path TEXT;
ALTER TABLE financial_situations ADD COLUMN IF NOT EXISTS invoice_file_name TEXT;

-- Bucket pour factures et photos opération
INSERT INTO storage.buckets (id, name, public)
VALUES ('financial-files', 'financial-files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read financial-files" ON storage.objects;
CREATE POLICY "Public read financial-files" ON storage.objects
  FOR SELECT USING (bucket_id = 'financial-files');

DROP POLICY IF EXISTS "Allow upload financial-files" ON storage.objects;
CREATE POLICY "Allow upload financial-files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'financial-files');

DROP POLICY IF EXISTS "Allow delete financial-files" ON storage.objects;
CREATE POLICY "Allow delete financial-files" ON storage.objects
  FOR DELETE USING (bucket_id = 'financial-files');

ALTER TABLE financial_bank_guarantees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on financial_bank_guarantees" ON financial_bank_guarantees;
CREATE POLICY "Allow all on financial_bank_guarantees" ON financial_bank_guarantees
  FOR ALL USING (true) WITH CHECK (true);

-- Phase 7 : suivi financier (lots, avenants, situations)
-- Exécuter ce script dans l'éditeur SQL de Supabase

-- Informations financières au niveau projet (onglet BDD)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS typology TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_address TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS default_payment_terms TEXT DEFAULT '30 JOURS';

-- Extension des entreprises = lots (1 entreprise = 1 lot)
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS lot_number TEXT;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS enterprise_address TEXT;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS contract_amount_ht NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS prorata_percent NUMERIC(8, 6) DEFAULT 0;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5, 2) DEFAULT 20;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS enterprises_updated_at ON enterprises;
CREATE TRIGGER enterprises_updated_at
  BEFORE UPDATE ON enterprises
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Avenants par lot (jusqu'à 15)
CREATE TABLE IF NOT EXISTS financial_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  amendment_number INTEGER NOT NULL,
  designation TEXT,
  os_number TEXT,
  amount_ht NUMERIC(15, 2) DEFAULT 0,
  amount_ttc NUMERIC(15, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (enterprise_id, amendment_number)
);

CREATE INDEX IF NOT EXISTS financial_amendments_enterprise_id_idx
  ON financial_amendments(enterprise_id);

DROP TRIGGER IF EXISTS financial_amendments_updated_at ON financial_amendments;
CREATE TRIGGER financial_amendments_updated_at
  BEFORE UPDATE ON financial_amendments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Situations mensuelles par lot
CREATE TABLE IF NOT EXISTS financial_situations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  situation_number INTEGER NOT NULL,
  situation_date DATE NOT NULL,
  works_cumulative_ht NUMERIC(15, 2) DEFAULT 0,
  amendment_works_cumulative_ht NUMERIC(15, 2) DEFAULT 0,
  prorata_cumulative_ht NUMERIC(15, 2) DEFAULT 0,
  retention_guarantee_cumulative_ht NUMERIC(15, 2) DEFAULT 0,
  retention_finition_cumulative_ht NUMERIC(15, 2) DEFAULT 0,
  retention_diverse_cumulative_ht NUMERIC(15, 2) DEFAULT 0,
  penalties_cumulative_ht NUMERIC(15, 2) DEFAULT 0,
  cie_cumulative_ht NUMERIC(15, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (enterprise_id, situation_number)
);

CREATE INDEX IF NOT EXISTS financial_situations_enterprise_id_idx
  ON financial_situations(enterprise_id);

DROP TRIGGER IF EXISTS financial_situations_updated_at ON financial_situations;
CREATE TRIGGER financial_situations_updated_at
  BEFORE UPDATE ON financial_situations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Délégations de paiement (sous-traitants / fournisseurs) par situation
CREATE TABLE IF NOT EXISTS financial_situation_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  situation_id UUID NOT NULL REFERENCES financial_situations(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  delegation_type TEXT NOT NULL DEFAULT 'subcontractor',
  delegation_amount NUMERIC(15, 2) DEFAULT 0,
  cumulative_ttc NUMERIC(15, 2) DEFAULT 0,
  previous_cumulative_ttc NUMERIC(15, 2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS financial_situation_delegations_situation_id_idx
  ON financial_situation_delegations(situation_id);

-- Historique des modifications
CREATE TABLE IF NOT EXISTS financial_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS financial_audit_log_project_id_idx
  ON financial_audit_log(project_id);

ALTER TABLE financial_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_situations ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_situation_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on financial_amendments" ON financial_amendments;
CREATE POLICY "Allow all on financial_amendments" ON financial_amendments
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on financial_situations" ON financial_situations;
CREATE POLICY "Allow all on financial_situations" ON financial_situations
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on financial_situation_delegations" ON financial_situation_delegations;
CREATE POLICY "Allow all on financial_situation_delegations" ON financial_situation_delegations
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on financial_audit_log" ON financial_audit_log;
CREATE POLICY "Allow all on financial_audit_log" ON financial_audit_log
  FOR ALL USING (true) WITH CHECK (true);

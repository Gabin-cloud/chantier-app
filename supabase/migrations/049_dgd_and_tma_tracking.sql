-- Suivi DGD (décomptes généraux définitifs) et TMA (travaux modificatifs acquéreurs)

-- ---------------------------------------------------------------------------
-- DGD : une ligne par entreprise / lot
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financial_dgd_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  enterprise_id UUID NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  projet_envoye_danobat DATE,
  projet_envoye_mou DATE,
  reserves_reception_levees BOOLEAN NOT NULL DEFAULT false,
  avis_bc_leves BOOLEAN NOT NULL DEFAULT false,
  sous_traitants_payes BOOLEAN NOT NULL DEFAULT false,
  cie_ok BOOLEAN NOT NULL DEFAULT false,
  avenants_ok BOOLEAN NOT NULL DEFAULT false,
  proposition_transmise_entreprise DATE,
  projet_retourne_entreprise DATE,
  exemplaire_signe_envoye_mou DATE,
  dgd_accepte_recu_danobat DATE,
  liberation_rg_cb DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, enterprise_id)
);

CREATE INDEX IF NOT EXISTS financial_dgd_entries_project_idx
  ON public.financial_dgd_entries(project_id);

DROP TRIGGER IF EXISTS financial_dgd_entries_updated_at ON public.financial_dgd_entries;
CREATE TRIGGER financial_dgd_entries_updated_at
  BEFORE UPDATE ON public.financial_dgd_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.financial_dgd_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_dgd_entries_select" ON public.financial_dgd_entries
  FOR SELECT USING (public.user_can_access_finance(project_id));

CREATE POLICY "financial_dgd_entries_write" ON public.financial_dgd_entries
  FOR ALL USING (public.user_can_edit_finance(project_id))
  WITH CHECK (public.user_can_edit_finance(project_id));

-- ---------------------------------------------------------------------------
-- TMA : travaux modificatifs acquéreurs (suivi des travaux)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_tma_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  logement_number TEXT NOT NULL DEFAULT '',
  localisation TEXT NOT NULL DEFAULT '',
  modif_demandee_le DATE,
  nature_travaux TEXT NOT NULL DEFAULT '',
  enterprise_id UUID REFERENCES public.enterprises(id) ON DELETE SET NULL,
  enterprise_name TEXT NOT NULL DEFAULT '',
  devis_number TEXT NOT NULL DEFAULT '',
  devis_recu_le DATE,
  mou_envoi DATE,
  mou_acceptation DATE,
  montant_ht NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS work_tma_entries_project_idx
  ON public.work_tma_entries(project_id, sort_order);

DROP TRIGGER IF EXISTS work_tma_entries_updated_at ON public.work_tma_entries;
CREATE TRIGGER work_tma_entries_updated_at
  BEFORE UPDATE ON public.work_tma_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.work_tma_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_tma_entries_select" ON public.work_tma_entries
  FOR SELECT USING (public.user_can_access_project(project_id));

CREATE POLICY "work_tma_entries_write" ON public.work_tma_entries
  FOR ALL USING (public.user_can_edit_project(project_id))
  WITH CHECK (public.user_can_edit_project(project_id));

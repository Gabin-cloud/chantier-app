-- TMA : dossiers questionnaire + statuts NF/PMR + mail type entreprise

CREATE TABLE IF NOT EXISTS public.work_tma_dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  logement_number TEXT NOT NULL DEFAULT '',
  nf_status TEXT CHECK (nf_status IN ('oui', 'non', 'nc')),
  pmr_status TEXT CHECK (pmr_status IN ('oui', 'non', 'nc')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  mou_document_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS work_tma_dossiers_project_idx
  ON public.work_tma_dossiers(project_id);

ALTER TABLE public.work_tma_entries
  ADD COLUMN IF NOT EXISTS dossier_id UUID REFERENCES public.work_tma_dossiers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nf_status TEXT CHECK (nf_status IN ('oui', 'non', 'nc')),
  ADD COLUMN IF NOT EXISTS pmr_status TEXT CHECK (pmr_status IN ('oui', 'non', 'nc')),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'completed'));

DROP TRIGGER IF EXISTS work_tma_dossiers_updated_at ON public.work_tma_dossiers;
CREATE TRIGGER work_tma_dossiers_updated_at
  BEFORE UPDATE ON public.work_tma_dossiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.work_tma_dossiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_tma_dossiers_select" ON public.work_tma_dossiers;
CREATE POLICY "work_tma_dossiers_select" ON public.work_tma_dossiers
  FOR SELECT USING (public.user_can_access_project(project_id));

DROP POLICY IF EXISTS "work_tma_dossiers_write" ON public.work_tma_dossiers;
CREATE POLICY "work_tma_dossiers_write" ON public.work_tma_dossiers
  FOR ALL USING (public.user_can_edit_project(project_id))
  WITH CHECK (public.user_can_edit_project(project_id));

INSERT INTO public.email_templates (slug, name, subject_template, body_template, default_cc)
VALUES (
  'tma_entreprise_send',
  'Envoi TMA aux entreprises',
  '{{project_name}} — TMA logement {{logement_number}}',
  '<p>Bonjour,</p><p>Veuillez trouver ci-joint notre demande de travaux modificatifs acquéreurs (TMA) pour le logement <strong>{{logement_number}}</strong> sur l''opération <strong>{{project_name}}</strong>.</p><p>Merci de nous retourner votre devis dans les meilleurs délais.</p><p>Cordialement,<br/>DANOBAT</p>',
  ''
)
ON CONFLICT (slug) DO NOTHING;

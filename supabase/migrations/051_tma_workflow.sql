-- TMA : workflow dépôts (analyse, comptabilité)

ALTER TABLE public.work_tma_entries
  ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES public.financial_quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deposit_file_path TEXT,
  ADD COLUMN IF NOT EXISTS deposit_file_name TEXT,
  ADD COLUMN IF NOT EXISTS is_request_line BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accounting_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS work_tma_entries_quote_idx
  ON public.work_tma_entries(quote_id);

CREATE INDEX IF NOT EXISTS work_tma_entries_status_idx
  ON public.work_tma_entries(project_id, status);

ALTER TABLE public.work_tma_entries
  DROP CONSTRAINT IF EXISTS work_tma_entries_status_check;

ALTER TABLE public.work_tma_entries
  ADD CONSTRAINT work_tma_entries_status_check
  CHECK (status IN ('draft', 'sent', 'to_analyze', 'analyzed', 'sent_to_accounting', 'completed'));

INSERT INTO public.email_templates (slug, name, subject_template, body_template, default_cc)
VALUES (
  'tma_comptabilite_send',
  'Envoi dépôts TMA à la comptabilité',
  '{{project_name}} — Dépôts TMA logement {{logement_numbers}}',
  '<p>Bonjour,</p><p>Veuillez trouver ci-joint les dépôts TMA analysés pour l''opération <strong>{{project_name}}</strong> (logements : {{logement_numbers}}).</p><p>Cordialement,<br/>DANOBAT</p>',
  ''
)
ON CONFLICT (slug) DO NOTHING;

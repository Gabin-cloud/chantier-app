-- Modèle mail avenant + chemin document PDF fusionné

ALTER TABLE public.financial_amendments
  ADD COLUMN IF NOT EXISTS document_path TEXT,
  ADD COLUMN IF NOT EXISTS document_file_name TEXT;

INSERT INTO public.email_templates (slug, name, subject_template, body_template, default_cc)
VALUES (
  'amendment_send',
  'Envoi avenant entreprise',
  '{{project_name}} — Avenant n°{{amendment_number}} {{amendment_type}} — Lot {{lot_number}}',
  '<p>Bonjour,</p><p>Veuillez trouver ci-joint l''avenant n°{{amendment_number}} ({{amendment_type}}) relatif au lot {{lot_number}} — {{lot_designation}} pour un montant de {{amount_ht}} H.T.</p><p>Les devis cités dans l''avenant sont joints à ce mail.</p><p>Merci de nous retourner l''avenant signé pour validation.</p><p>Cordialement,<br/>DANOBAT</p>',
  ''
)
ON CONFLICT (slug) DO NOTHING;

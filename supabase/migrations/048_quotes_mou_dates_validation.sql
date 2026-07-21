-- Dates MOU + statut validation Oui/Non sur les devis

ALTER TABLE public.financial_quotes
  ADD COLUMN IF NOT EXISTS mou_sent_at DATE,
  ADD COLUMN IF NOT EXISTS mou_return_at DATE,
  ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('pending', 'yes', 'no'));

-- Migrer les données existantes
UPDATE public.financial_quotes
SET validation_status = CASE
  WHEN is_rejected THEN 'no'
  WHEN validated_at IS NOT NULL THEN 'yes'
  ELSE 'pending'
END
WHERE validation_status = 'pending'
  AND (is_rejected OR validated_at IS NOT NULL);

INSERT INTO public.email_templates (slug, name, subject_template, body_template, default_cc)
VALUES (
  'devis_mou_send',
  'Envoi devis au maître d''ouvrage',
  '{{project_name}} — Devis lot {{lot_numbers}} — {{quote_count}} devis',
  '<p>Bonjour,</p><p>Veuillez trouver ci-joint {{quote_count}} devis relatifs à l''opération <strong>{{project_name}}</strong>.</p><p>Lots concernés : {{lot_numbers}}</p><p>Montant total H.T. : {{total_ht}}</p><p>Cordialement,<br/>DANOBAT</p>',
  ''
)
ON CONFLICT (slug) DO NOTHING;

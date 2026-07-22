-- TMA : catégorie Outlook + mail type envoi MOU

ALTER TABLE public.incoming_files
  DROP CONSTRAINT IF EXISTS incoming_files_category_check;

ALTER TABLE public.incoming_files
  ADD CONSTRAINT incoming_files_category_check
  CHECK (
    category IN (
      'facture',
      'devis',
      'administratif',
      'chantier',
      'plan_exe',
      'levee_controle',
      'tma',
      'autre'
    )
  );

INSERT INTO public.email_templates (slug, name, subject_template, body_template, default_cc)
VALUES (
  'tma_mou_send',
  'Envoi dépôts TMA au maître d''ouvrage',
  '{{project_name}} — TMA logement {{logement_numbers}}',
  '<p>Bonjour,</p><p>Veuillez trouver ci-joint les devis TMA pour l''opération <strong>{{project_name}}</strong> (logements : {{logement_numbers}}).</p><p>Total H.T. : <strong>{{total_ht}}</strong></p><p>Cordialement,<br/>DANOBAT</p>',
  ''
)
ON CONFLICT (slug) DO NOTHING;

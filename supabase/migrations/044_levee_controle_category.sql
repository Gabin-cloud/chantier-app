-- Catégorie Outlook : levée point de contrôle

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
      'autre'
    )
  );

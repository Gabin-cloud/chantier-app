-- SharePoint : chemins par chantier et catégorie plan d'exé

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS sharepoint_plan_exe_path TEXT;

ALTER TABLE public.enterprises
  ADD COLUMN IF NOT EXISTS sharepoint_folder_name TEXT;

ALTER TABLE public.incoming_files
  ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS external_item_id TEXT;

ALTER TABLE public.incoming_files
  DROP CONSTRAINT IF EXISTS incoming_files_category_check;

ALTER TABLE public.incoming_files
  ADD CONSTRAINT incoming_files_category_check
  CHECK (category IN ('facture', 'devis', 'administratif', 'chantier', 'plan_exe', 'autre'));

-- Boîte de tri : fichiers reçus par mail classés par catégorie

CREATE TABLE IF NOT EXISTS public.incoming_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  enterprise_id uuid REFERENCES public.enterprises(id) ON DELETE SET NULL,
  situation_id uuid REFERENCES public.financial_situations(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('facture', 'devis', 'administratif', 'chantier', 'autre')),
  file_path text NOT NULL,
  file_name text NOT NULL,
  source_email text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incoming_files_project_id_idx ON public.incoming_files(project_id);
CREATE INDEX IF NOT EXISTS incoming_files_enterprise_id_idx ON public.incoming_files(enterprise_id);
CREATE INDEX IF NOT EXISTS incoming_files_category_idx ON public.incoming_files(category);

ALTER TABLE public.incoming_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incoming_files_select" ON public.incoming_files
  FOR SELECT USING (public.user_can_access_finance(project_id));

CREATE POLICY "incoming_files_write" ON public.incoming_files
  FOR ALL USING (public.user_can_edit_finance(project_id))
  WITH CHECK (public.user_can_edit_finance(project_id));

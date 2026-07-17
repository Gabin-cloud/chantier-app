-- Pièces administratives : référentiel global, configuration par opération, dépôts par lot.

-- ---------------------------------------------------------------------------
-- Référentiel global (modèles de pièces)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_piece_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  control_notes TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_piece_templates_sort_idx
  ON public.admin_piece_templates(sort_order, name);

DROP TRIGGER IF EXISTS admin_piece_templates_updated_at ON public.admin_piece_templates;
CREATE TRIGGER admin_piece_templates_updated_at
  BEFORE UPDATE ON public.admin_piece_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Pièces système OS / AE (toujours présentes dans chaque opération)
INSERT INTO public.admin_piece_templates (name, control_notes, sort_order, is_system)
SELECT v.name, v.control_notes, v.sort_order, v.is_system
FROM (VALUES
  ('Ordre de service (OS)'::text, 'Vérifier signatures MOA, MOE et entreprise, numéro OS et date de notification.'::text, 0, true),
  ('Acte d''engagement (AE)'::text, 'Vérifier signatures, montant, délais et annexes contractuelles.'::text, 1, true)
) AS v(name, control_notes, sort_order, is_system)
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_piece_templates t WHERE t.is_system AND t.sort_order = v.sort_order
);

-- Pièces courantes (référentiel)
INSERT INTO public.admin_piece_templates (name, control_notes, sort_order, is_system)
SELECT v.name, v.control_notes, v.sort_order, false
FROM (VALUES
  ('Attestation d''assurance décennale', 'Vérifier validité, montants garantis et activités couvertes.', 10),
  ('Attestation URSSAF', 'Document de moins de 6 mois, conforme au cahier des charges.', 11),
  ('K-bis ou extrait RNE', 'Document récent (< 3 mois), raison sociale et SIRET conformes.', 12),
  ('Liste nominative du personnel', 'Liste à jour avec qualifications et habilitations.', 13),
  ('Plan de prévention (PDP)', 'Signé par l''entreprise et validé MOE.', 14),
  ('Attestation de vigilance fiscale', 'Document en cours de validité.', 15)
) AS v(name, control_notes, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_piece_templates t WHERE t.name = v.name
);

-- ---------------------------------------------------------------------------
-- Configuration par opération (pièces requises)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_admin_pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.admin_piece_templates(id) ON DELETE SET NULL,
  piece_key TEXT NOT NULL,
  name TEXT NOT NULL,
  control_notes TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_os BOOLEAN NOT NULL DEFAULT false,
  is_ae BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, piece_key)
);

CREATE INDEX IF NOT EXISTS project_admin_pieces_project_id_idx
  ON public.project_admin_pieces(project_id, sort_order);

DROP TRIGGER IF EXISTS project_admin_pieces_updated_at ON public.project_admin_pieces;
CREATE TRIGGER project_admin_pieces_updated_at
  BEFORE UPDATE ON public.project_admin_pieces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Dépôts / statuts par entreprise (lot)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enterprise_admin_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  enterprise_id UUID NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  project_admin_piece_id UUID NOT NULL REFERENCES public.project_admin_pieces(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'validated', 'rejected')),
  file_path TEXT,
  file_name TEXT,
  rejection_comment TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (enterprise_id, project_admin_piece_id)
);

CREATE INDEX IF NOT EXISTS enterprise_admin_submissions_project_idx
  ON public.enterprise_admin_submissions(project_id);
CREATE INDEX IF NOT EXISTS enterprise_admin_submissions_enterprise_idx
  ON public.enterprise_admin_submissions(enterprise_id);

DROP TRIGGER IF EXISTS enterprise_admin_submissions_updated_at ON public.enterprise_admin_submissions;
CREATE TRIGGER enterprise_admin_submissions_updated_at
  BEFORE UPDATE ON public.enterprise_admin_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.admin_piece_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_piece_templates_select" ON public.admin_piece_templates;
CREATE POLICY "admin_piece_templates_select" ON public.admin_piece_templates
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "admin_piece_templates_write" ON public.admin_piece_templates;
CREATE POLICY "admin_piece_templates_write" ON public.admin_piece_templates
  FOR ALL USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
        AND pm.role::text IN ('admin', 'gestionnaire')
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
        AND pm.role::text IN ('admin', 'gestionnaire')
    )
  );

ALTER TABLE public.project_admin_pieces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_admin_pieces_select" ON public.project_admin_pieces;
CREATE POLICY "project_admin_pieces_select" ON public.project_admin_pieces
  FOR SELECT USING (public.user_can_access_project(project_id));

DROP POLICY IF EXISTS "project_admin_pieces_write" ON public.project_admin_pieces;
CREATE POLICY "project_admin_pieces_write" ON public.project_admin_pieces
  FOR ALL USING (public.user_can_manage_project(project_id))
  WITH CHECK (public.user_can_manage_project(project_id));

ALTER TABLE public.enterprise_admin_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "enterprise_admin_submissions_select" ON public.enterprise_admin_submissions;
CREATE POLICY "enterprise_admin_submissions_select" ON public.enterprise_admin_submissions
  FOR SELECT USING (
    public.user_can_access_project(project_id)
    OR enterprise_id = public.user_enterprise_id_for_project(project_id)
  );

DROP POLICY IF EXISTS "enterprise_admin_submissions_insert" ON public.enterprise_admin_submissions;
CREATE POLICY "enterprise_admin_submissions_insert" ON public.enterprise_admin_submissions
  FOR INSERT WITH CHECK (
    public.user_can_manage_project(project_id)
    OR enterprise_id = public.user_enterprise_id_for_project(project_id)
  );

DROP POLICY IF EXISTS "enterprise_admin_submissions_update" ON public.enterprise_admin_submissions;
CREATE POLICY "enterprise_admin_submissions_update" ON public.enterprise_admin_submissions
  FOR UPDATE USING (
    public.user_can_manage_project(project_id)
    OR (
      enterprise_id = public.user_enterprise_id_for_project(project_id)
      AND status IN ('pending', 'submitted', 'rejected')
    )
  )
  WITH CHECK (
    public.user_can_manage_project(project_id)
    OR enterprise_id = public.user_enterprise_id_for_project(project_id)
  );

DROP POLICY IF EXISTS "enterprise_admin_submissions_delete" ON public.enterprise_admin_submissions;
CREATE POLICY "enterprise_admin_submissions_delete" ON public.enterprise_admin_submissions
  FOR DELETE USING (public.user_can_manage_project(project_id));

-- Stockage : financial-files/{project_id}/admin-pieces/{enterprise_id}/...
DROP POLICY IF EXISTS "admin_pieces_storage_select" ON storage.objects;
CREATE POLICY "admin_pieces_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'financial-files'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IS NOT NULL
  );

DROP POLICY IF EXISTS "admin_pieces_storage_insert" ON storage.objects;
CREATE POLICY "admin_pieces_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'financial-files'
    AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "admin_pieces_storage_delete" ON storage.objects;
CREATE POLICY "admin_pieces_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'financial-files'
    AND auth.uid() IS NOT NULL
  );

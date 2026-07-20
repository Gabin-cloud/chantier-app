-- Suivi des travaux : types de plans, niveaux, exécutions de contrôle par plan

-- ---------------------------------------------------------------------------
-- Types de plans / supports (par opération)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_control_plan_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, name)
);

CREATE INDEX IF NOT EXISTS work_control_plan_types_project_idx
  ON public.work_control_plan_types(project_id, sort_order);

-- Types par défaut pour chaque opération existante
INSERT INTO public.work_control_plan_types (project_id, name, sort_order, is_system)
SELECT p.id, v.name, v.sort_order, true
FROM public.projects p
CROSS JOIN (
  VALUES
    ('Plans architecte', 1),
    ('Plans béton', 2),
    ('Plans électricité (ELEX)', 3),
    ('Plans plomberie', 4),
    ('Autres plans', 5)
) AS v(name, sort_order)
ON CONFLICT (project_id, name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Plans : rattachement à un type
-- ---------------------------------------------------------------------------
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS plan_type_id UUID
    REFERENCES public.work_control_plan_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS plans_plan_type_id_idx ON public.plans(plan_type_id);

-- ---------------------------------------------------------------------------
-- Niveaux / zones sur un plan (RDC A, RDC B, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_control_plan_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, name)
);

CREATE INDEX IF NOT EXISTS work_control_plan_levels_plan_idx
  ON public.work_control_plan_levels(plan_id, sort_order);

-- ---------------------------------------------------------------------------
-- Points de contrôle : support, aide, commentaires prédéfinis
-- ---------------------------------------------------------------------------
ALTER TABLE public.phase_checklist_items
  ADD COLUMN IF NOT EXISTS plan_type_id UUID
    REFERENCES public.work_control_plan_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS help_comment TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS preset_comments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- Exécutions : contrôle par point × niveau de plan × entreprise
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_control_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id UUID NOT NULL
    REFERENCES public.phase_checklist_items(id) ON DELETE CASCADE,
  plan_level_id UUID NOT NULL
    REFERENCES public.work_control_plan_levels(id) ON DELETE CASCADE,
  enterprise_id UUID REFERENCES public.enterprises(id) ON DELETE SET NULL,
  control_result TEXT NOT NULL DEFAULT 'pending'
    CHECK (control_result IN ('pending', 'ok', 'ko', 'partial')),
  control_date DATE,
  visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL,
  report_path TEXT,
  attestation_date DATE,
  in_attestation BOOLEAN NOT NULL DEFAULT false,
  admin_waived BOOLEAN NOT NULL DEFAULT false,
  admin_waived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_waived_at TIMESTAMPTZ,
  preset_comment TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (checklist_item_id, plan_level_id)
);

CREATE INDEX IF NOT EXISTS work_control_executions_checklist_idx
  ON public.work_control_executions(checklist_item_id);
CREATE INDEX IF NOT EXISTS work_control_executions_enterprise_idx
  ON public.work_control_executions(enterprise_id);
CREATE INDEX IF NOT EXISTS work_control_executions_plan_level_idx
  ON public.work_control_executions(plan_level_id);

DROP TRIGGER IF EXISTS work_control_executions_updated_at ON public.work_control_executions;
CREATE TRIGGER work_control_executions_updated_at
  BEFORE UPDATE ON public.work_control_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.work_control_plan_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_control_plan_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_control_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_control_plan_types_access ON public.work_control_plan_types;
CREATE POLICY work_control_plan_types_access ON public.work_control_plan_types
  FOR ALL
  USING (public.user_can_access_project(project_id))
  WITH CHECK (public.user_can_manage_project(project_id));

DROP POLICY IF EXISTS work_control_plan_levels_access ON public.work_control_plan_levels;
CREATE POLICY work_control_plan_levels_access ON public.work_control_plan_levels
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.plans pl
      WHERE pl.id = plan_id
        AND public.user_can_access_project(pl.project_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plans pl
      WHERE pl.id = plan_id
        AND public.user_can_edit_field(pl.project_id)
    )
  );

DROP POLICY IF EXISTS work_control_executions_select ON public.work_control_executions;
CREATE POLICY work_control_executions_select ON public.work_control_executions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.phase_checklist_items pci
      JOIN public.visit_phases vp ON vp.id = pci.phase_id
      WHERE pci.id = checklist_item_id
        AND public.user_can_access_project(vp.project_id)
    )
  );

DROP POLICY IF EXISTS work_control_executions_write ON public.work_control_executions;
CREATE POLICY work_control_executions_write ON public.work_control_executions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.phase_checklist_items pci
      JOIN public.visit_phases vp ON vp.id = pci.phase_id
      WHERE pci.id = checklist_item_id
        AND public.user_can_edit_field(vp.project_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.phase_checklist_items pci
      JOIN public.visit_phases vp ON vp.id = pci.phase_id
      WHERE pci.id = checklist_item_id
        AND public.user_can_edit_field(vp.project_id)
    )
  );

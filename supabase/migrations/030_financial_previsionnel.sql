-- Prévisionnel financier : colonnes configurables et saisies manuelles

CREATE TYPE public.previsionnel_column_type AS ENUM (
  'situation_amount',
  'situation_percent',
  'manual_cumulative',
  'manual_monthly',
  'manual_percent'
);

CREATE TABLE IF NOT EXISTS public.financial_previsionnel_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  column_type public.previsionnel_column_type NOT NULL,
  month_date DATE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS financial_previsionnel_columns_project_id_idx
  ON public.financial_previsionnel_columns(project_id);

DROP TRIGGER IF EXISTS financial_previsionnel_columns_updated_at ON public.financial_previsionnel_columns;
CREATE TRIGGER financial_previsionnel_columns_updated_at
  BEFORE UPDATE ON public.financial_previsionnel_columns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.financial_previsionnel_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id UUID NOT NULL REFERENCES public.financial_previsionnel_columns(id) ON DELETE CASCADE,
  enterprise_id UUID NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  raw_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (column_id, enterprise_id)
);

CREATE INDEX IF NOT EXISTS financial_previsionnel_cells_column_id_idx
  ON public.financial_previsionnel_cells(column_id);

CREATE INDEX IF NOT EXISTS financial_previsionnel_cells_enterprise_id_idx
  ON public.financial_previsionnel_cells(enterprise_id);

DROP TRIGGER IF EXISTS financial_previsionnel_cells_updated_at ON public.financial_previsionnel_cells;
CREATE TRIGGER financial_previsionnel_cells_updated_at
  BEFORE UPDATE ON public.financial_previsionnel_cells
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.financial_previsionnel_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  enterprise_id UUID NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, enterprise_id)
);

CREATE INDEX IF NOT EXISTS financial_previsionnel_comments_project_id_idx
  ON public.financial_previsionnel_comments(project_id);

DROP TRIGGER IF EXISTS financial_previsionnel_comments_updated_at ON public.financial_previsionnel_comments;
CREATE TRIGGER financial_previsionnel_comments_updated_at
  BEFORE UPDATE ON public.financial_previsionnel_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.financial_previsionnel_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_previsionnel_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_previsionnel_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "previsionnel_columns_select" ON public.financial_previsionnel_columns
  FOR SELECT USING (public.user_can_access_finance(project_id));

CREATE POLICY "previsionnel_columns_write" ON public.financial_previsionnel_columns
  FOR ALL USING (public.user_can_edit_finance(project_id))
  WITH CHECK (public.user_can_edit_finance(project_id));

CREATE POLICY "previsionnel_cells_select" ON public.financial_previsionnel_cells
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.financial_previsionnel_columns c
      WHERE c.id = column_id
        AND public.user_can_access_finance(c.project_id)
    )
  );

CREATE POLICY "previsionnel_cells_write" ON public.financial_previsionnel_cells
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.financial_previsionnel_columns c
      WHERE c.id = column_id
        AND public.user_can_edit_finance(c.project_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.financial_previsionnel_columns c
      WHERE c.id = column_id
        AND public.user_can_edit_finance(c.project_id)
    )
  );

CREATE POLICY "previsionnel_comments_select" ON public.financial_previsionnel_comments
  FOR SELECT USING (public.user_can_access_finance(project_id));

CREATE POLICY "previsionnel_comments_write" ON public.financial_previsionnel_comments
  FOR ALL USING (public.user_can_edit_finance(project_id))
  WITH CHECK (public.user_can_edit_finance(project_id));

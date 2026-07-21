-- Suivi des devis + lignes d'avenant + métadonnées document avenant

CREATE TABLE IF NOT EXISTS public.financial_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  enterprise_id UUID NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL DEFAULT '',
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_cie BOOLEAN NOT NULL DEFAULT false,
  is_ts BOOLEAN NOT NULL DEFAULT false,
  is_tma BOOLEAN NOT NULL DEFAULT false,
  designation TEXT,
  amount_ht NUMERIC(14, 2) NOT NULL DEFAULT 0,
  is_rejected BOOLEAN NOT NULL DEFAULT false,
  validated_at DATE,
  amendment_id UUID REFERENCES public.financial_amendments(id) ON DELETE SET NULL,
  comment TEXT,
  file_path TEXT,
  file_name TEXT,
  signed_file_path TEXT,
  signed_file_name TEXT,
  incoming_file_id UUID REFERENCES public.incoming_files(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS financial_quotes_project_id_idx
  ON public.financial_quotes(project_id);
CREATE INDEX IF NOT EXISTS financial_quotes_enterprise_id_idx
  ON public.financial_quotes(enterprise_id);
CREATE INDEX IF NOT EXISTS financial_quotes_amendment_id_idx
  ON public.financial_quotes(amendment_id);

DROP TRIGGER IF EXISTS financial_quotes_updated_at ON public.financial_quotes;
CREATE TRIGGER financial_quotes_updated_at
  BEFORE UPDATE ON public.financial_quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.financial_amendment_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amendment_id UUID NOT NULL REFERENCES public.financial_amendments(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  designation TEXT NOT NULL DEFAULT '',
  amount_ht NUMERIC(14, 2) NOT NULL DEFAULT 0,
  quote_id UUID REFERENCES public.financial_quotes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS financial_amendment_lines_amendment_id_idx
  ON public.financial_amendment_lines(amendment_id);

ALTER TABLE public.financial_amendments
  ADD COLUMN IF NOT EXISTS document_html TEXT,
  ADD COLUMN IF NOT EXISTS danobat_comment TEXT;

ALTER TABLE public.financial_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_amendment_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_quotes_select" ON public.financial_quotes
  FOR SELECT USING (public.user_can_access_finance(project_id));

CREATE POLICY "financial_quotes_write" ON public.financial_quotes
  FOR ALL USING (public.user_can_edit_finance(project_id))
  WITH CHECK (public.user_can_edit_finance(project_id));

CREATE POLICY "financial_amendment_lines_select" ON public.financial_amendment_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.financial_amendments a
      JOIN public.enterprises e ON e.id = a.enterprise_id
      WHERE a.id = amendment_id
        AND public.user_can_access_finance(e.project_id)
    )
  );

CREATE POLICY "financial_amendment_lines_write" ON public.financial_amendment_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.financial_amendments a
      JOIN public.enterprises e ON e.id = a.enterprise_id
      WHERE a.id = amendment_id
        AND public.user_can_edit_finance(e.project_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.financial_amendments a
      JOIN public.enterprises e ON e.id = a.enterprise_id
      WHERE a.id = amendment_id
        AND public.user_can_edit_finance(e.project_id)
    )
  );

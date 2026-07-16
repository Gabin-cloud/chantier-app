-- Déjà appliqué sur Supabase (financial_amendment_workflow)
ALTER TABLE public.financial_amendments
  ADD COLUMN IF NOT EXISTS amendment_type TEXT;

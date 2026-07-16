-- Déjà appliqué sur Supabase (amendment_signature_statuses)
ALTER TABLE public.financial_amendments
  ADD COLUMN IF NOT EXISTS signature_status TEXT;

ALTER TABLE public.financial_amendments
  ADD COLUMN IF NOT EXISTS internal_comment TEXT;

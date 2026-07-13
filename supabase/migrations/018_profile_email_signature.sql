-- Signature e-mail personnelle par utilisateur

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_signature_html TEXT;

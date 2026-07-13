-- Copie carbone par défaut sur le modèle de mail

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS default_cc TEXT;

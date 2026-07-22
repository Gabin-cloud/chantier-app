-- TMA : contrôle chantier + acceptation explicite
-- MOA : modèle Excel situation de travaux

ALTER TABLE public.work_tma_entries
  ADD COLUMN IF NOT EXISTS controle_chantier DATE;

ALTER TABLE public.owner_directory
  ADD COLUMN IF NOT EXISTS situation_template_path TEXT,
  ADD COLUMN IF NOT EXISTS situation_template_name TEXT;

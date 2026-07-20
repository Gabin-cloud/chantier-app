-- Nom de fichier d'attestation pour affichage PC / Outlook

ALTER TABLE public.work_control_executions
  ADD COLUMN IF NOT EXISTS report_file_name TEXT;

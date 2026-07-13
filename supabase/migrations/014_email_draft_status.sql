-- Autoriser le statut "draft" dans les logs email

ALTER TABLE public.visit_email_logs
  DROP CONSTRAINT IF EXISTS visit_email_logs_status_check;

ALTER TABLE public.visit_email_logs
  ADD CONSTRAINT visit_email_logs_status_check
  CHECK (status IN ('sent', 'failed', 'skipped', 'draft'));

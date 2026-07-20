-- Dates d'envoi mail et reprise demandée sur les rapports de visite

ALTER TABLE public.visit_reports
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resume_requested_at DATE;

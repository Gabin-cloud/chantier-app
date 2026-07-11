-- Points de contrôle liés aux réserves + zones + synthèse visite
-- Exécuter dans l'éditeur SQL Supabase (ou npm run db:push)

ALTER TABLE phase_checklist_items
  ADD COLUMN IF NOT EXISTS zone_name TEXT;

ALTER TABLE markers
  ADD COLUMN IF NOT EXISTS checklist_item_id UUID REFERENCES phase_checklist_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS control_result TEXT
    CHECK (control_result IS NULL OR control_result IN ('ok', 'ko', 'partial'));

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS control_summary TEXT
    CHECK (control_summary IS NULL OR control_summary IN ('pending', 'ok', 'partial', 'ko'));

CREATE INDEX IF NOT EXISTS markers_checklist_item_id_idx ON markers(checklist_item_id);

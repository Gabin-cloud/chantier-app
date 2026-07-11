-- Dessins partagés par phase (comme les pastilles)
-- Exécuter dans l'éditeur SQL Supabase

ALTER TABLE plan_drawings
  ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES visit_phases(id) ON DELETE CASCADE;

UPDATE plan_drawings pd
SET phase_id = v.phase_id
FROM visits v
WHERE pd.visit_id = v.id
  AND pd.phase_id IS NULL
  AND v.phase_id IS NOT NULL;

-- Fusionner les doublons phase+plan en gardant le plus récent
DELETE FROM plan_drawings a
USING plan_drawings b
WHERE a.phase_id IS NOT NULL
  AND b.phase_id IS NOT NULL
  AND a.phase_id = b.phase_id
  AND a.plan_id = b.plan_id
  AND a.page_number = b.page_number
  AND a.updated_at < b.updated_at;

ALTER TABLE plan_drawings
  DROP CONSTRAINT IF EXISTS plan_drawings_visit_id_plan_id_page_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS plan_drawings_phase_plan_page_uidx
  ON plan_drawings (phase_id, plan_id, page_number)
  WHERE phase_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS plan_drawings_phase_id_idx ON plan_drawings(phase_id);

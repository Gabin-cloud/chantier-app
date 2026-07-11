-- Zones par phase, bibliothèque globale, scope visite, rapports et emails

CREATE TABLE IF NOT EXISTS phase_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES visit_phases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (phase_id, name)
);

ALTER TABLE phase_checklist_items
  ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES phase_zones(id) ON DELETE SET NULL;

-- Backfill zones depuis zone_name existant
INSERT INTO phase_zones (phase_id, name, sort_order)
SELECT DISTINCT ON (phase_id, zone_name)
  phase_id,
  zone_name,
  0
FROM phase_checklist_items
WHERE zone_name IS NOT NULL AND TRIM(zone_name) <> ''
ORDER BY phase_id, zone_name;

UPDATE phase_checklist_items pci
SET zone_id = pz.id
FROM phase_zones pz
WHERE pci.phase_id = pz.phase_id
  AND pci.zone_name IS NOT NULL
  AND TRIM(pci.zone_name) = pz.name
  AND pci.zone_id IS NULL;

CREATE TABLE IF NOT EXISTS control_library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_name TEXT NOT NULL DEFAULT 'Gros œuvre',
  zone_name TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bibliothèque type HARMONIE (échantillon, si vide)
INSERT INTO control_library_items (phase_name, zone_name, label, sort_order)
SELECT v.phase_name, v.zone_name, v.label, v.sort_order
FROM (VALUES
  ('Gros œuvre', 'FOND DE FOUILLE', 'Vérification fondations / semelles', 1),
  ('Gros œuvre', 'FOND DE FOUILLE', 'Contrôle ferraillage', 2),
  ('Gros œuvre', 'RESEAUX SOUS DALLAGE', 'Réseaux EU / EV / AEP', 3),
  ('Gros œuvre', 'RESEAUX SOUS DALLAGE', 'Isolation et protection réseaux', 4),
  ('Gros œuvre', 'COTES EN SOUS-SOL', 'Cotes et niveaux sous-sol', 5),
  ('Second œuvre', 'CLOISONS', 'Mise en place cloisons', 6),
  ('Second œuvre', 'MENUISERIES', 'Pose huisseries', 7),
  ('Livraison', 'FINITIONS', 'Contrôle finitions générales', 8)
) AS v(phase_name, zone_name, label, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM control_library_items LIMIT 1);

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES phase_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checklist_item_id UUID REFERENCES phase_checklist_items(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS visit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visit_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  enterprise_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS phase_zones_phase_id_idx ON phase_zones(phase_id);
CREATE INDEX IF NOT EXISTS visits_zone_id_idx ON visits(zone_id);
CREATE INDEX IF NOT EXISTS visit_reports_visit_id_idx ON visit_reports(visit_id);

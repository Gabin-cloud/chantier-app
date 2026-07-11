-- Suivi tableau de contrôle : attestations et levée des non-conformités

CREATE TABLE IF NOT EXISTS control_point_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id UUID NOT NULL REFERENCES phase_checklist_items(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
  control_date DATE,
  control_result TEXT CHECK (control_result IS NULL OR control_result IN ('ok', 'ko', 'partial')),
  enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL,
  attestation_date DATE,
  non_conformity_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (checklist_item_id)
);

CREATE INDEX IF NOT EXISTS control_point_tracking_checklist_item_id_idx
  ON control_point_tracking(checklist_item_id);

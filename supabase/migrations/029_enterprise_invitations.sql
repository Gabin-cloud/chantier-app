-- Journal des invitations e-mail envoyées aux entreprises.

CREATE TABLE IF NOT EXISTS enterprise_email_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (enterprise_id, email)
);

CREATE INDEX IF NOT EXISTS idx_enterprise_email_invitations_enterprise
  ON enterprise_email_invitations (enterprise_id);

ALTER TABLE enterprise_email_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enterprise_email_invitations_select"
  ON enterprise_email_invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM enterprises e
      JOIN project_members pm ON pm.project_id = e.project_id
      WHERE e.id = enterprise_email_invitations.enterprise_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "enterprise_email_invitations_insert"
  ON enterprise_email_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM enterprises e
      JOIN project_members pm ON pm.project_id = e.project_id
      WHERE e.id = enterprise_email_invitations.enterprise_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('admin', 'gestionnaire')
    )
  );

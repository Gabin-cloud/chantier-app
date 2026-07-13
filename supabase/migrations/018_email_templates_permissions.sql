-- Autoriser admin/gestionnaire de projet à modifier les mails type

CREATE OR REPLACE FUNCTION public.can_manage_email_templates()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.project_members
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'gestionnaire')
    );
$$;

DROP POLICY IF EXISTS email_templates_write_super_admin ON public.email_templates;

CREATE POLICY email_templates_write_managers
  ON public.email_templates
  FOR ALL
  TO authenticated
  USING (public.can_manage_email_templates())
  WITH CHECK (public.can_manage_email_templates());

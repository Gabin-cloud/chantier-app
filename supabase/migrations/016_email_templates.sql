-- Modèles de mails type avec étiquettes dynamiques

CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS email_templates_updated_at ON public.email_templates;
CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_templates_select_authenticated
  ON public.email_templates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY email_templates_write_super_admin
  ON public.email_templates
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

INSERT INTO public.email_templates (slug, name, subject_template, body_template)
VALUES (
  'visit_report',
  'Compte-rendu de visite',
  '[{{nom_operation}}] Visite du {{date_controle}} — {{synthese}}',
  '<div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;line-height:1.5;max-width:640px">
  <h2 style="color:#111827;margin-bottom:8px">Compte-rendu de visite de chantier</h2>
  <p>Bonjour {{nom_contact}},</p>
  <p>
    Une visite a été réalisée sur le chantier <strong>{{nom_operation}}</strong>
    (maître d''ouvrage : <strong>{{nom_maitre_ouvrage}}</strong>)
    le <strong>{{date_controle}}</strong>.
  </p>
  <table style="border-collapse:collapse;margin:16px 0;width:100%">
    <tr><td style="padding:6px 0;color:#6b7280">Visite</td><td><strong>{{titre_visite}}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#6b7280">Phase</td><td>{{phase}}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280">Zone</td><td>{{zone}}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280">Contrôle</td><td>{{titre_controle}}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280">Synthèse</td><td><strong>{{synthese}}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#6b7280">Réserves</td><td>{{nb_reserves}}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280">Non-conformités</td><td>{{nb_non_conformites}}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280">Entreprise(s)</td><td>{{nom_entreprise}}</td></tr>
  </table>
  <p style="background:#fef3c7;padding:12px;border-radius:8px">
    <strong>Action requise :</strong> merci de nous faire parvenir vos éléments de réponse
    avant le <strong>{{date_jour_plus_15}}</strong>.
  </p>
  <p style="color:#6b7280;font-size:13px;margin-top:24px">
    Le rapport PDF est joint à ce message.
  </p>
</div>'
)
ON CONFLICT (slug) DO NOTHING;

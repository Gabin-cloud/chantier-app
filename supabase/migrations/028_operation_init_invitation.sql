-- État initialisation fiche opération + modèle mail invitation plateforme.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_operation_configured BOOLEAN NOT NULL DEFAULT FALSE;

-- Les opérations existantes restent déverrouillées.
UPDATE projects SET is_operation_configured = TRUE WHERE is_operation_configured = FALSE;

INSERT INTO public.email_templates (slug, name, subject_template, body_template)
VALUES (
  'platform_invitation',
  'Invitation plateforme',
  'Invitation — {{nom_operation}} ({{nom_entreprise}})',
  '<div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;line-height:1.5;max-width:640px">
  <h2 style="color:#1a4b8c;margin-bottom:8px">Invitation à la plateforme chantier</h2>
  <p>Bonjour,</p>
  <p>
    Vous êtes invité(e) à accéder à la plateforme de suivi de chantier pour
    l''opération <strong>{{nom_operation}}</strong>
    (entreprise : <strong>{{nom_entreprise}}</strong>).
  </p>
  <p>
    Connectez-vous ou créez votre compte sur le lien suivant&nbsp;:
    <br /><a href="{{lien_plateforme}}" style="color:#1a4b8c">{{lien_plateforme}}</a>
  </p>
  <p style="color:#6b7280;font-size:13px">
    Une fois connecté(e), vous pourrez consulter les informations de votre lot
    et déposer les documents demandés.
  </p>
  <div style="margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px">
    {{signature}}
  </div>
</div>'
)
ON CONFLICT (slug) DO NOTHING;

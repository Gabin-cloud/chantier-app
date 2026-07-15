import {
  applyMergeTags,
  applyMergeTagsHtml,
} from "@/lib/notifications/merge-tags";

export const INVITATION_EMAIL_MERGE_TAGS = [
  { key: "nom_operation", label: "Nom de l'opération", description: "Nom du projet", example: "Harmonie" },
  { key: "nom_entreprise", label: "Nom de l'entreprise", description: "Entreprise invitée", example: "COMMINGES" },
  { key: "lien_plateforme", label: "Lien plateforme", description: "URL de connexion", example: "https://app.example.com/login" },
  { key: "signature", label: "Signature personnelle", description: "Signature HTML du profil", example: "Cordialement" },
] as const;

export const DEFAULT_INVITATION_SUBJECT =
  "Invitation — {{nom_operation}} ({{nom_entreprise}})";

export const DEFAULT_INVITATION_BODY = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;line-height:1.5;max-width:640px">
  <h2 style="color:#1a4b8c;margin-bottom:8px">Invitation à la plateforme chantier</h2>
  <p>Bonjour,</p>
  <p>
    Vous êtes invité(e) à accéder à la plateforme de suivi de chantier pour
    l'opération <strong>{{nom_operation}}</strong>
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
</div>`;

export type InvitationDraftInput = {
  projectName: string;
  enterpriseName: string;
  platformUrl: string;
  signatureHtml: string | null;
};

export function buildInvitationMergeValues(input: InvitationDraftInput) {
  return {
    nom_operation: input.projectName,
    nom_entreprise: input.enterpriseName,
    lien_plateforme: input.platformUrl,
    signature: input.signatureHtml ?? "",
  };
}

export function buildInvitationEmailFromTemplates(
  subjectTemplate: string,
  bodyTemplate: string,
  input: InvitationDraftInput
) {
  const values = buildInvitationMergeValues(input);
  return {
    subject: applyMergeTags(subjectTemplate, values).trim(),
    htmlBody: applyMergeTagsHtml(bodyTemplate, values),
  };
}

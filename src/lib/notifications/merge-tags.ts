import { VISIT_CONTROL_SUMMARY_LABELS } from "@/lib/types/database";
import type { VisitControlSummary } from "@/lib/types/database";

export type VisitDraftInput = {
  projectName: string;
  clientName: string | null;
  visitTitle: string;
  visitDate: string;
  phaseName: string | null;
  zoneName: string | null;
  controlLabel: string | null;
  controlSummary: VisitControlSummary;
  recipients: { email: string; name: string }[];
  enterpriseNames: string[];
  markerCount: number;
  nonConformCount: number;
  signatureHtml: string | null;
};

export type MergeTagDefinition = {
  key: string;
  label: string;
  description: string;
  example: string;
};

export const VISIT_EMAIL_MERGE_TAGS: MergeTagDefinition[] = [
  {
    key: "nom_operation",
    label: "Nom de l'opération",
    description: "Nom du projet / chantier",
    example: "Harmonie",
  },
  {
    key: "nom_maitre_ouvrage",
    label: "Nom du maître d'ouvrage",
    description: "Client renseigné dans le module finance",
    example: "Ville de Toulouse",
  },
  {
    key: "date_controle",
    label: "Date du contrôle",
    description: "Date de la visite",
    example: "vendredi 11 juillet 2026",
  },
  {
    key: "date_jour",
    label: "Date du jour",
    description: "Date du jour de rédaction",
    example: "lundi 13 juillet 2026",
  },
  {
    key: "date_jour_plus_15",
    label: "Date du jour + 15 jours",
    description: "Échéance à J+15",
    example: "lundi 28 juillet 2026",
  },
  {
    key: "titre_visite",
    label: "Titre de la visite",
    description: "Intitulé de la visite",
    example: "Test PCO V2",
  },
  {
    key: "titre_controle",
    label: "Titre du contrôlé",
    description: "Point de contrôle ciblé",
    example: "Contrôle cloison",
  },
  {
    key: "phase",
    label: "Phase",
    description: "Phase de la visite",
    example: "Second œuvre",
  },
  {
    key: "zone",
    label: "Zone",
    description: "Zone de la visite",
    example: "Cloisons",
  },
  {
    key: "synthese",
    label: "Synthèse",
    description: "Résultat global du contrôle",
    example: "Partiellement conforme",
  },
  {
    key: "nom_entreprise",
    label: "Nom entreprise",
    description: "Entreprise(s) destinataire(s)",
    example: "COMMINGES",
  },
  {
    key: "nom_contact",
    label: "Nom contact",
    description: "Contact(s) destinataire(s)",
    example: "M. Dupont",
  },
  {
    key: "nb_reserves",
    label: "Nombre de réserves",
    description: "Nombre de pastilles sur la visite",
    example: "5",
  },
  {
    key: "nb_non_conformites",
    label: "Nombre de non-conformités",
    description: "Pastilles KO ou partielles",
    example: "2",
  },
  {
    key: "signature",
    label: "Signature personnelle",
    description: "Signature HTML de l'utilisateur (Profil)",
    example: "Cordialement, Jean Dupont",
  },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildMergeTagValues(input: VisitDraftInput): Record<string, string> {
  const today = new Date();
  const recipientNames = input.recipients.map((r) => r.name).join(", ");
  const enterpriseNames = input.enterpriseNames.join(", ");

  return {
    nom_operation: input.projectName,
    nom_maitre_ouvrage: input.clientName ?? "",
    date_controle: formatDate(input.visitDate),
    date_jour: formatDate(today.toISOString().slice(0, 10)),
    date_jour_plus_15: formatDate(addDays(today, 15).toISOString().slice(0, 10)),
    titre_visite: input.visitTitle,
    titre_controle: input.controlLabel ?? "",
    phase: input.phaseName ?? "",
    zone: input.zoneName ?? "",
    synthese: VISIT_CONTROL_SUMMARY_LABELS[input.controlSummary],
    nom_entreprise: enterpriseNames,
    nom_contact: recipientNames,
    nb_reserves: String(input.markerCount),
    nb_non_conformites: String(input.nonConformCount),
    signature: input.signatureHtml ?? "",
  };
}

export function applyMergeTags(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key: string) => {
    const normalized = key.toLowerCase();
    return values[normalized] ?? "";
  });
}

export function applyMergeTagsHtml(template: string, values: Record<string, string>) {
  const rawHtmlKeys = new Set(["signature"]);
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key: string) => {
    const normalized = key.toLowerCase();
    const value = values[normalized] ?? "";
    if (rawHtmlKeys.has(normalized)) {
      return value;
    }
    return escapeHtml(value);
  });
}

export const DEFAULT_VISIT_EMAIL_SUBJECT =
  "[{{nom_operation}}] Visite du {{date_controle}} — {{synthese}}";

export const DEFAULT_VISIT_EMAIL_BODY = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;line-height:1.5;max-width:640px">
  <h2 style="color:#111827;margin-bottom:8px">Compte-rendu de visite de chantier</h2>
  <p>Bonjour {{nom_contact}},</p>
  <p>
    Une visite a été réalisée sur le chantier <strong>{{nom_operation}}</strong>
    (maître d'ouvrage : <strong>{{nom_maitre_ouvrage}}</strong>)
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
  <div style="margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px">
    {{signature}}
  </div>
</div>`;

export function buildVisitEmailFromTemplates(
  subjectTemplate: string,
  bodyTemplate: string,
  input: VisitDraftInput
) {
  const values = buildMergeTagValues(input);
  return {
    subject: applyMergeTags(subjectTemplate, values).trim(),
    htmlBody: applyMergeTagsHtml(bodyTemplate, values),
  };
}

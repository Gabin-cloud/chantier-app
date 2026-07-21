import { formatCurrency } from "@/lib/finance/calculations";
import type { MergeTagDefinition } from "@/lib/notifications/merge-tags";

export const DEFAULT_TMA_ENTREPRISE_EMAIL_SUBJECT =
  "{{project_name}} — TMA logement {{logement_number}}";

export const DEFAULT_TMA_ENTREPRISE_EMAIL_BODY = `<p>Bonjour,</p><p>Veuillez trouver ci-joint notre demande de travaux modificatifs acquéreurs (TMA) pour le logement <strong>{{logement_number}}</strong> sur l'opération <strong>{{project_name}}</strong>.</p><p>Merci de nous retourner votre devis dans les meilleurs délais.</p><p>Cordialement,<br/>DANOBAT</p>`;

export const TMA_ENTREPRISE_EMAIL_MERGE_TAGS: MergeTagDefinition[] = [
  {
    key: "project_name",
    label: "Nom de l'opération",
    description: "Nom du projet / chantier",
    example: "Harmonie",
  },
  {
    key: "logement_number",
    label: "N° logement",
    description: "Numéro du logement concerné",
    example: "A12",
  },
  {
    key: "enterprise_names",
    label: "Entreprises concernées",
    description: "Liste des entreprises du dossier TMA",
    example: "MOREIA, ELEX",
  },
  {
    key: "line_count",
    label: "Nombre de lignes",
    description: "Nombre de travaux modificatifs",
    example: "3",
  },
];

export type TmaEntrepriseEmailDraftInput = {
  projectName: string;
  logementNumber: string;
  enterpriseNames: string[];
  lineCount: number;
};

function replaceMergeTags(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
}

export function buildTmaEntrepriseEmailFromTemplates(
  subjectTemplate: string,
  bodyTemplate: string,
  input: TmaEntrepriseEmailDraftInput
): { subject: string; htmlBody: string } {
  const uniqueEnterprises = Array.from(new Set(input.enterpriseNames.filter(Boolean)));
  const values: Record<string, string> = {
    project_name: input.projectName,
    logement_number: input.logementNumber,
    enterprise_names: uniqueEnterprises.length ? uniqueEnterprises.join(", ") : "—",
    line_count: String(input.lineCount),
  };

  return {
    subject: replaceMergeTags(subjectTemplate, values).trim(),
    htmlBody: replaceMergeTags(bodyTemplate, values).trim(),
  };
}

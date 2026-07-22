import { formatCurrency } from "@/lib/finance/calculations";
import type { MergeTagDefinition } from "@/lib/notifications/merge-tags";

export const DEFAULT_TMA_COMPTABILITE_EMAIL_SUBJECT =
  "{{project_name}} — Dépôts TMA logement {{logement_numbers}}";

export const DEFAULT_TMA_COMPTABILITE_EMAIL_BODY = `<p>Bonjour,</p><p>Veuillez trouver ci-joint les dépôts TMA analysés pour l'opération <strong>{{project_name}}</strong> (logements : {{logement_numbers}}).</p><p>Total H.T. : <strong>{{total_ht}}</strong></p><p>Cordialement,<br/>DANOBAT</p>`;

export const TMA_COMPTABILITE_EMAIL_MERGE_TAGS: MergeTagDefinition[] = [
  {
    key: "project_name",
    label: "Nom de l'opération",
    description: "Nom du projet / chantier",
    example: "Harmonie",
  },
  {
    key: "logement_numbers",
    label: "N° logements",
    description: "Liste des logements concernés",
    example: "A12, B03",
  },
  {
    key: "deposit_count",
    label: "Nombre de dépôts",
    description: "Nombre de fichiers PDF joints",
    example: "3",
  },
  {
    key: "total_ht",
    label: "Total H.T.",
    description: "Somme des montants H.T. analysés",
    example: "12 450,00 €",
  },
];

export type TmaComptabiliteEmailDraftInput = {
  projectName: string;
  logementNumbers: string[];
  depositCount: number;
  totalHt: number;
};

function replaceMergeTags(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
}

export function buildTmaComptabiliteEmailFromTemplates(
  subjectTemplate: string,
  bodyTemplate: string,
  input: TmaComptabiliteEmailDraftInput
): { subject: string; htmlBody: string } {
  const logements = Array.from(new Set(input.logementNumbers.filter(Boolean)));
  const values: Record<string, string> = {
    project_name: input.projectName,
    logement_numbers: logements.length ? logements.join(", ") : "—",
    deposit_count: String(input.depositCount),
    total_ht: formatCurrency(input.totalHt),
  };

  return {
    subject: replaceMergeTags(subjectTemplate, values).trim(),
    htmlBody: replaceMergeTags(bodyTemplate, values).trim(),
  };
}

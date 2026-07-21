import { formatCurrency } from "@/lib/finance/calculations";
import type { MergeTagDefinition } from "@/lib/notifications/merge-tags";

export const DEFAULT_DEVIS_MOU_EMAIL_SUBJECT =
  "{{project_name}} — Devis lot {{lot_numbers}} — {{quote_count}} devis";

export const DEFAULT_DEVIS_MOU_EMAIL_BODY = `<p>Bonjour,</p><p>Veuillez trouver ci-joint {{quote_count}} devis relatifs à l'opération <strong>{{project_name}}</strong>.</p><p>Lots concernés : {{lot_numbers}}</p><p>Montant total H.T. : {{total_ht}}</p><p>Cordialement,<br/>DANOBAT</p>`;

export const DEVIS_MOU_EMAIL_MERGE_TAGS: MergeTagDefinition[] = [
  {
    key: "project_name",
    label: "Nom de l'opération",
    description: "Nom du projet / chantier",
    example: "Harmonie",
  },
  {
    key: "lot_numbers",
    label: "Numéros de lot",
    description: "Lots concernés par les devis sélectionnés",
    example: "03, 05",
  },
  {
    key: "quote_count",
    label: "Nombre de devis",
    description: "Nombre de devis joints au mail",
    example: "3",
  },
  {
    key: "total_ht",
    label: "Montant total H.T.",
    description: "Somme des montants H.T. des devis sélectionnés",
    example: "45 000,00 €",
  },
];

export type DevisMouEmailDraftInput = {
  projectName: string;
  lotNumbers: string[];
  quoteCount: number;
  totalHt: number;
};

function replaceMergeTags(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
}

function formatLotNumbers(lotNumbers: string[]): string {
  const unique = Array.from(new Set(lotNumbers.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "fr", { numeric: true })
  );
  return unique.length ? unique.join(", ") : "—";
}

export function buildDevisMouEmailFromTemplates(
  subjectTemplate: string,
  bodyTemplate: string,
  input: DevisMouEmailDraftInput
): { subject: string; htmlBody: string } {
  const values: Record<string, string> = {
    project_name: input.projectName,
    lot_numbers: formatLotNumbers(input.lotNumbers),
    quote_count: String(input.quoteCount),
    total_ht: formatCurrency(input.totalHt),
  };

  return {
    subject: replaceMergeTags(subjectTemplate, values).trim(),
    htmlBody: replaceMergeTags(bodyTemplate, values).trim(),
  };
}

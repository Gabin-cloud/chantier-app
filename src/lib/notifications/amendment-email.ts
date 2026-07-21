import { formatCurrency } from "@/lib/finance/calculations";
import type { MergeTagDefinition } from "@/lib/notifications/merge-tags";

export const DEFAULT_AMENDMENT_EMAIL_SUBJECT =
  "{{project_name}} — Avenant n°{{amendment_number}} {{amendment_type}} — Lot {{lot_number}}";

export const DEFAULT_AMENDMENT_EMAIL_BODY = `<p>Bonjour,</p><p>Veuillez trouver ci-joint l'avenant n°{{amendment_number}} ({{amendment_type}}) relatif au lot {{lot_number}} — {{lot_designation}} pour un montant de {{amount_ht}} H.T.</p><p>Les devis cités dans l'avenant sont joints à ce mail.</p><p>Merci de nous retourner l'avenant signé pour validation.</p><p>Cordialement,<br/>DANOBAT</p>`;

export const AMENDMENT_EMAIL_MERGE_TAGS: MergeTagDefinition[] = [
  {
    key: "project_name",
    label: "Nom de l'opération",
    description: "Nom du projet / chantier",
    example: "Harmonie",
  },
  {
    key: "amendment_number",
    label: "Numéro d'avenant",
    description: "Numéro séquentiel de l'avenant",
    example: "01",
  },
  {
    key: "amendment_type",
    label: "Type d'avenant",
    description: "TS ou TMA",
    example: "TS",
  },
  {
    key: "lot_number",
    label: "Numéro de lot",
    description: "Numéro du lot concerné",
    example: "03",
  },
  {
    key: "lot_designation",
    label: "Désignation du lot",
    description: "Intitulé du lot",
    example: "Menuiseries extérieures",
  },
  {
    key: "enterprise_name",
    label: "Nom de l'entreprise",
    description: "Raison sociale de l'entreprise",
    example: "Dupont SARL",
  },
  {
    key: "amount_ht",
    label: "Montant H.T.",
    description: "Montant total de l'avenant hors taxes",
    example: "12 500,00 €",
  },
];

export type AmendmentEmailDraftInput = {
  projectName: string;
  amendmentNumber: number;
  amendmentType: "ts" | "tma";
  lotNumber: string | null;
  lotDesignation: string | null;
  enterpriseName: string;
  amountHt: number;
};

function padAmendmentNumber(value: number): string {
  return String(value).padStart(2, "0");
}

function replaceMergeTags(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
}

export function buildAmendmentEmailFromTemplates(
  subjectTemplate: string,
  bodyTemplate: string,
  input: AmendmentEmailDraftInput
): { subject: string; htmlBody: string } {
  const values: Record<string, string> = {
    project_name: input.projectName,
    amendment_number: padAmendmentNumber(input.amendmentNumber),
    amendment_type: input.amendmentType.toUpperCase(),
    lot_number: input.lotNumber ?? "",
    lot_designation: input.lotDesignation ?? "",
    enterprise_name: input.enterpriseName,
    amount_ht: formatCurrency(input.amountHt),
  };

  return {
    subject: replaceMergeTags(subjectTemplate, values).trim(),
    htmlBody: replaceMergeTags(bodyTemplate, values).trim(),
  };
}

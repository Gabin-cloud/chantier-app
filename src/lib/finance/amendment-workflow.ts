import type { AmendmentSignatureStatus, AmendmentType } from "@/lib/types/database";

export const DEFAULT_AMENDMENT_COLUMNS = 5;

export const AMENDMENT_TYPE_LABELS: Record<AmendmentType, string> = {
  ts: "TS",
  tma: "TMA",
};

export const AMENDMENT_SIGNATURE_STATUS_LABELS: Record<
  AmendmentSignatureStatus,
  string
> = {
  devis_recu_non_valide: "Devis reçu non validé",
  devis_valide_avenant_a_faire: "Devis validé, avenant à faire",
  chez_entreprise: "Avenant chez entreprise",
  chez_moe: "Avenant chez le MOE",
  valide_classe: "Avenant validé + classé",
};

/** Statuts affichés avec couleur de fond dans la synthèse (comme l'Excel métier). */
export const COLORED_SIGNATURE_STATUSES: AmendmentSignatureStatus[] = [
  "chez_entreprise",
  "chez_moe",
  "valide_classe",
];

export const AMENDMENT_SIGNATURE_STATUS_COLORS: Partial<
  Record<AmendmentSignatureStatus, string>
> = {
  chez_entreprise: "bg-amber-100",
  chez_moe: "bg-sky-100",
  valide_classe: "bg-emerald-100",
};

export function getAmendmentAmountTextClass(type: AmendmentType): string {
  return type === "tma" ? "text-blue-600" : "text-slate-900";
}

export function getAmendmentCellBackground(
  status: AmendmentSignatureStatus
): string {
  return AMENDMENT_SIGNATURE_STATUS_COLORS[status] ?? "";
}

export function computeAmendmentColumnCount(
  maxAmendmentNumber: number
): number {
  return Math.max(DEFAULT_AMENDMENT_COLUMNS, maxAmendmentNumber);
}

type RawAmendment = {
  amendment_type?: AmendmentType | null;
  signature_status?: AmendmentSignatureStatus | null;
  internal_comment?: string | null;
};

export function normalizeAmendment<T extends RawAmendment>(amendment: T) {
  return {
    ...amendment,
    amendment_type: amendment.amendment_type ?? "ts",
    signature_status: amendment.signature_status ?? "devis_recu_non_valide",
    internal_comment: amendment.internal_comment ?? null,
  };
}

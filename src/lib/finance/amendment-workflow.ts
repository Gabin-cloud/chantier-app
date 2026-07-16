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
  chez_entreprise: "Avenant chez entreprise",
  chez_mou: "Avenant chez le MOU",
  valide_classe: "Avenant validé + classé",
};

export const AMENDMENT_SIGNATURE_STATUSES = Object.keys(
  AMENDMENT_SIGNATURE_STATUS_LABELS
) as AmendmentSignatureStatus[];

export const AMENDMENT_SIGNATURE_STATUS_COLORS: Record<
  AmendmentSignatureStatus,
  string
> = {
  chez_entreprise: "bg-yellow-100",
  chez_mou: "bg-orange-100",
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

const LEGACY_SIGNATURE_STATUS_MAP: Record<string, AmendmentSignatureStatus> = {
  devis_recu_non_valide: "chez_entreprise",
  devis_valide_avenant_a_faire: "chez_entreprise",
  chez_moe: "chez_mou",
  chez_entreprise: "chez_entreprise",
  chez_mou: "chez_mou",
  valide_classe: "valide_classe",
};

export function normalizeSignatureStatus(
  status?: string | null
): AmendmentSignatureStatus {
  if (!status) return "chez_entreprise";
  return LEGACY_SIGNATURE_STATUS_MAP[status] ?? "chez_entreprise";
}

type RawAmendment = {
  amendment_type?: AmendmentType | null;
  signature_status?: string | null;
  internal_comment?: string | null;
};

export function normalizeAmendment<T extends RawAmendment>(amendment: T) {
  return {
    ...amendment,
    amendment_type: amendment.amendment_type ?? "ts",
    signature_status: normalizeSignatureStatus(amendment.signature_status),
    internal_comment: amendment.internal_comment ?? null,
  };
}

/** Action attendue de notre part — règles métier à définir. */
export function lotNeedsFinanceAction(_lot: {
  amendments?: { signature_status: AmendmentSignatureStatus }[];
  situations?: unknown[];
}): boolean {
  return false;
}

import { parseMoneyInput } from "@/lib/finance/calculations";
import type {
  AmendmentFormData,
  AmendmentSignatureStatus,
  AmendmentType,
} from "@/lib/types/database";

const AMENDMENT_TYPES = new Set<AmendmentType>(["ts", "tma"]);
const SIGNATURE_STATUSES = new Set<AmendmentSignatureStatus>([
  "devis_recu_non_valide",
  "devis_valide_avenant_a_faire",
  "chez_entreprise",
  "chez_moe",
  "valide_classe",
]);

export function parseAmendmentFormData(
  form: FormData,
  fallbackNumber?: number
): { ok: true; data: AmendmentFormData } | { ok: false; error: string } {
  const amendmentNumber = Number(
    form.get("amendment_number") || fallbackNumber || 0
  );
  if (!Number.isFinite(amendmentNumber) || amendmentNumber < 1) {
    return { ok: false, error: "Numéro d'avenant invalide." };
  }

  const amount_ht = parseMoneyInput(String(form.get("amount_ht") ?? ""));
  if (!Number.isFinite(amount_ht)) {
    return { ok: false, error: "Montant H.T. invalide." };
  }

  const amendmentType = form.get("amendment_type") as AmendmentType;
  const signatureStatus = form.get("signature_status") as AmendmentSignatureStatus;

  return {
    ok: true,
    data: {
      amendment_number: amendmentNumber,
      designation: (form.get("designation") as string).trim() || undefined,
      os_number: (form.get("os_number") as string).trim() || undefined,
      amount_ht,
      amendment_type: AMENDMENT_TYPES.has(amendmentType) ? amendmentType : "ts",
      signature_status: SIGNATURE_STATUSES.has(signatureStatus)
        ? signatureStatus
        : "devis_recu_non_valide",
      internal_comment:
        (form.get("internal_comment") as string).trim() || undefined,
    },
  };
}

export function formatAmendmentDbError(message: string): string {
  if (
    message.includes("amendment_type") ||
    message.includes("signature_status") ||
    message.includes("internal_comment")
  ) {
    return "La base de données n'a pas encore été mise à jour (migration 030). Exécutez : npm run db:push";
  }
  return message;
}

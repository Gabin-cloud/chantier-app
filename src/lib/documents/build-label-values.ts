import type { Enterprise, Project } from "@/lib/types/database";
import { formatNumberDisplay } from "@/lib/validation/numbers";

export type DocumentLabelContextExtras = {
  numero_os?: string;
  date_os?: string;
  designation_travaux?: string;
  delai_execution?: string;
};

function formatDateFr(date = new Date()) {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function buildDocumentLabelValuesFromContext(
  project: Pick<
    Project,
    | "name"
    | "address"
    | "postal_code"
    | "city"
    | "owner_name"
    | "owner_address"
    | "owner_postal_code"
    | "owner_city"
    | "owner_signatory_name"
    | "owner_signatory_email"
    | "moe_address"
    | "moe_postal_code"
    | "moe_city"
    | "default_payment_terms"
  >,
  enterprise: Pick<
    Enterprise,
    | "name"
    | "enterprise_address"
    | "enterprise_postal_code"
    | "enterprise_city"
    | "siret"
    | "signataire_name"
    | "lot_number"
    | "designation"
    | "contract_amount_ht"
    | "vat_rate"
    | "payment_terms"
  > | null,
  extras: DocumentLabelContextExtras = {}
): Record<string, string> {
  const ht = enterprise?.contract_amount_ht ?? 0;
  const vat = enterprise?.vat_rate ?? 20;
  const ttc = ht * (1 + vat / 100);
  const today = formatDateFr();

  return {
    nom_operation: project.name ?? "",
    adresse_operation: project.address ?? "",
    code_postal_operation: project.postal_code ?? "",
    ville_operation: project.city ?? "",
    nom_maitre_ouvrage: project.owner_name ?? "",
    adresse_maitre_ouvrage: project.owner_address ?? "",
    code_postal_maitre_ouvrage: project.owner_postal_code ?? "",
    ville_maitre_ouvrage: project.owner_city ?? "",
    signataire_maitre_ouvrage: project.owner_signatory_name ?? "",
    mail_signataire_moa: project.owner_signatory_email ?? "",
    nom_entreprise: enterprise?.name ?? "",
    adresse_entreprise: enterprise?.enterprise_address ?? "",
    code_postal_entreprise: enterprise?.enterprise_postal_code ?? "",
    ville_entreprise: enterprise?.enterprise_city ?? "",
    siret_entreprise: enterprise?.siret ?? "",
    signataire_entreprise: enterprise?.signataire_name ?? "",
    lot_numero: enterprise?.lot_number ?? "",
    lot_designation: enterprise?.designation ?? "",
    montant_marche_ht: `${formatNumberDisplay(ht, 2)} €`,
    montant_marche_ttc: `${formatNumberDisplay(ttc, 2)} €`,
    taux_tva: `${formatNumberDisplay(vat, 0)} %`,
    delai_paiement:
      enterprise?.payment_terms?.trim() ||
      project.default_payment_terms?.trim() ||
      "",
    numero_os: extras.numero_os ?? "",
    date_os: extras.date_os ?? today,
    designation_travaux: extras.designation_travaux ?? enterprise?.designation ?? "",
    delai_execution: extras.delai_execution ?? "",
    date_jour: today,
    nom_moe: "DANOBAT",
  };
}

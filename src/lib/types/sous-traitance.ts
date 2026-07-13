export type SousTraitanceType = "demande_sous_traitance" | "choix_travaux";

export type SousTraitanceStatus =
  | "brouillon"
  | "soumise"
  | "en_revision"
  | "acceptee"
  | "refusee";

export const SOUS_TRAITANCE_TYPE_LABELS: Record<SousTraitanceType, string> = {
  demande_sous_traitance: "Demande de sous-traitance",
  choix_travaux: "Choix de travaux",
};

export const SOUS_TRAITANCE_STATUS_LABELS: Record<SousTraitanceStatus, string> = {
  brouillon: "Brouillon",
  soumise: "Soumise",
  en_revision: "En révision",
  acceptee: "Acceptée",
  refusee: "Refusée",
};

export type SousTraitanceRequest = {
  id: string;
  project_id: string;
  enterprise_id: string;
  type: SousTraitanceType;
  title: string;
  description: string;
  status: SousTraitanceStatus;
  deadline: string | null;
  amount_ht: number | null;
  reference: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  enterprises?: {
    name: string;
    lot_number: string | null;
    trade: string | null;
  };
};

export type SousTraitanceFormData = {
  type: SousTraitanceType;
  title: string;
  description: string;
  deadline: string;
  amount_ht: string;
  reference: string;
};

export type EnterpriseProjectAccess = {
  project_id: string;
  enterprise_id: string;
  role: "entreprise";
  projects: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    description: string | null;
  };
  enterprises: {
    id: string;
    name: string;
    lot_number: string | null;
    trade: string | null;
  };
};

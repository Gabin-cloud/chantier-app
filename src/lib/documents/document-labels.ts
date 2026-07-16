export type DocumentDocType = "os" | "ae";

export type DocumentLabelDefinition = {
  key: string;
  label: string;
  description: string;
  example: string;
  category: string;
  isSystem: boolean;
};

export const DOCUMENT_DOC_TYPE_LABELS: Record<DocumentDocType, string> = {
  os: "Ordre de service (OS)",
  ae: "Acte d'engagement",
};

export const DOCUMENT_LABEL_CATEGORY_LABELS: Record<string, string> = {
  operation: "Opération",
  moa: "Maître d'ouvrage",
  moe: "Maîtrise d'œuvre",
  entreprise: "Entreprise",
  marche: "Marché",
  os: "Ordre de service",
  general: "Général",
};

/** Étiquettes de base utilisées si la table n'est pas encore migrée. */
export const DEFAULT_DOCUMENT_LABELS: DocumentLabelDefinition[] = [
  {
    key: "nom_operation",
    label: "Nom de l'opération",
    description: "Nom du chantier / opération",
    example: "Résidence Les Jardins",
    category: "operation",
    isSystem: true,
  },
  {
    key: "adresse_operation",
    label: "Adresse opération",
    description: "Adresse du chantier",
    example: "12 rue de la République",
    category: "operation",
    isSystem: true,
  },
  {
    key: "code_postal_operation",
    label: "Code postal opération",
    description: "Code postal du chantier",
    example: "31000",
    category: "operation",
    isSystem: true,
  },
  {
    key: "ville_operation",
    label: "Ville opération",
    description: "Ville du chantier",
    example: "Toulouse",
    category: "operation",
    isSystem: true,
  },
  {
    key: "nom_maitre_ouvrage",
    label: "Nom maître d'ouvrage",
    description: "Raison sociale du MOA",
    example: "Ville de Toulouse",
    category: "moa",
    isSystem: true,
  },
  {
    key: "adresse_maitre_ouvrage",
    label: "Adresse maître d'ouvrage",
    description: "Adresse du MOA",
    example: "1 place du Capitole",
    category: "moa",
    isSystem: true,
  },
  {
    key: "code_postal_maitre_ouvrage",
    label: "Code postal maître d'ouvrage",
    description: "Code postal du MOA",
    example: "31000",
    category: "moa",
    isSystem: true,
  },
  {
    key: "ville_maitre_ouvrage",
    label: "Ville maître d'ouvrage",
    description: "Ville du MOA",
    example: "Toulouse",
    category: "moa",
    isSystem: true,
  },
  {
    key: "signataire_maitre_ouvrage",
    label: "Signataire maître d'ouvrage",
    description: "Nom du signataire MOA",
    example: "Mme Dupont",
    category: "moa",
    isSystem: true,
  },
  {
    key: "mail_signataire_moa",
    label: "Mail signataire MOA",
    description: "E-mail du signataire MOA",
    example: "dupont@ville-toulouse.fr",
    category: "moa",
    isSystem: true,
  },
  {
    key: "nom_entreprise",
    label: "Nom entreprise",
    description: "Raison sociale de l'entreprise titulaire",
    example: "SARL Comminges",
    category: "entreprise",
    isSystem: true,
  },
  {
    key: "adresse_entreprise",
    label: "Adresse entreprise",
    description: "Adresse de l'entreprise",
    example: "45 avenue de Lyon",
    category: "entreprise",
    isSystem: true,
  },
  {
    key: "code_postal_entreprise",
    label: "Code postal entreprise",
    description: "Code postal de l'entreprise",
    example: "31200",
    category: "entreprise",
    isSystem: true,
  },
  {
    key: "ville_entreprise",
    label: "Ville entreprise",
    description: "Ville de l'entreprise",
    example: "Toulouse",
    category: "entreprise",
    isSystem: true,
  },
  {
    key: "siret_entreprise",
    label: "SIRET entreprise",
    description: "Numéro SIRET",
    example: "123 456 789 00012",
    category: "entreprise",
    isSystem: true,
  },
  {
    key: "signataire_entreprise",
    label: "Signataire entreprise",
    description: "Nom du signataire entreprise",
    example: "M. Martin",
    category: "entreprise",
    isSystem: true,
  },
  {
    key: "lot_numero",
    label: "N° de lot",
    description: "Numéro du lot",
    example: "03",
    category: "marche",
    isSystem: true,
  },
  {
    key: "lot_designation",
    label: "Désignation du lot",
    description: "Intitulé du lot",
    example: "Cloisons / Doublages",
    category: "marche",
    isSystem: true,
  },
  {
    key: "montant_marche_ht",
    label: "Montant marché HT",
    description: "Montant HT du marché",
    example: "125 000,00 €",
    category: "marche",
    isSystem: true,
  },
  {
    key: "montant_marche_ttc",
    label: "Montant marché TTC",
    description: "Montant TTC du marché",
    example: "150 000,00 €",
    category: "marche",
    isSystem: true,
  },
  {
    key: "taux_tva",
    label: "Taux de TVA",
    description: "Taux de TVA applicable",
    example: "20 %",
    category: "marche",
    isSystem: true,
  },
  {
    key: "delai_paiement",
    label: "Délai de paiement",
    description: "Conditions / délai de paiement",
    example: "30 jours",
    category: "marche",
    isSystem: true,
  },
  {
    key: "numero_os",
    label: "N° d'OS",
    description: "Numéro d'ordre de service",
    example: "OS-2026-014",
    category: "os",
    isSystem: true,
  },
  {
    key: "date_os",
    label: "Date d'OS",
    description: "Date de l'ordre de service",
    example: "16 juillet 2026",
    category: "os",
    isSystem: true,
  },
  {
    key: "designation_travaux",
    label: "Désignation des travaux",
    description: "Objet des travaux / OS",
    example: "Mise en œuvre cloisons R+2",
    category: "os",
    isSystem: true,
  },
  {
    key: "delai_execution",
    label: "Délai d'exécution",
    description: "Délai d'exécution des travaux",
    example: "45 jours",
    category: "os",
    isSystem: true,
  },
  {
    key: "date_jour",
    label: "Date du jour",
    description: "Date de rédaction du document",
    example: "16 juillet 2026",
    category: "general",
    isSystem: true,
  },
  {
    key: "nom_moe",
    label: "Nom maîtrise d'œuvre",
    description: "Identité de la maîtrise d'œuvre",
    example: "DANOBAT",
    category: "moe",
    isSystem: true,
  },
];

export const DEFAULT_OS_ENABLED_LABELS = [
  "nom_operation",
  "adresse_operation",
  "ville_operation",
  "nom_maitre_ouvrage",
  "signataire_maitre_ouvrage",
  "nom_entreprise",
  "lot_numero",
  "lot_designation",
  "montant_marche_ht",
  "numero_os",
  "date_os",
  "designation_travaux",
  "delai_execution",
  "date_jour",
  "nom_moe",
];

export const DEFAULT_AE_ENABLED_LABELS = [
  "nom_operation",
  "adresse_operation",
  "code_postal_operation",
  "ville_operation",
  "nom_maitre_ouvrage",
  "adresse_maitre_ouvrage",
  "signataire_maitre_ouvrage",
  "nom_entreprise",
  "adresse_entreprise",
  "siret_entreprise",
  "signataire_entreprise",
  "lot_numero",
  "lot_designation",
  "montant_marche_ht",
  "montant_marche_ttc",
  "taux_tva",
  "delai_paiement",
  "date_jour",
  "nom_moe",
];

export const DEFAULT_OS_BODY_HTML = `<div style="font-family:'Segoe UI',Arial,sans-serif;color:#111827;line-height:1.55">
  <p style="text-align:right;margin:0 0 8px;color:#64748b;font-size:13px">{{date_jour}}</p>
  <h1 style="text-align:center;font-size:20px;margin:0 0 4px;letter-spacing:0.04em">ORDRE DE SERVICE</h1>
  <p style="text-align:center;margin:0 0 24px;font-size:14px;color:#475569">N° {{numero_os}} — {{date_os}}</p>

  <p><strong>Opération :</strong> {{nom_operation}}</p>
  <p><strong>Adresse du chantier :</strong> {{adresse_operation}}, {{ville_operation}}</p>
  <p><strong>Maître d'ouvrage :</strong> {{nom_maitre_ouvrage}}</p>
  <p><strong>Maîtrise d'œuvre :</strong> {{nom_moe}}</p>

  <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0" />

  <p><strong>Entreprise titulaire :</strong> {{nom_entreprise}}</p>
  <p><strong>Lot n° {{lot_numero}}</strong> — {{lot_designation}}</p>
  <p><strong>Montant du marché HT :</strong> {{montant_marche_ht}}</p>

  <h2 style="font-size:15px;margin:24px 0 8px">Objet</h2>
  <p>Par le présent ordre de service, l'entreprise est invitée à exécuter les travaux suivants :</p>
  <p><strong>{{designation_travaux}}</strong></p>
  <p><strong>Délai d'exécution :</strong> {{delai_execution}}</p>

  <p style="margin-top:28px">Fait à {{ville_operation}}, le {{date_jour}}.</p>

  <table style="width:100%;margin-top:36px;border-collapse:collapse">
    <tr>
      <td style="width:50%;vertical-align:top;padding-right:16px">
        <p style="margin:0 0 48px;font-size:13px;color:#64748b">Pour le maître d'ouvrage</p>
        <p style="margin:0"><strong>{{signataire_maitre_ouvrage}}</strong></p>
      </td>
      <td style="width:50%;vertical-align:top;padding-left:16px">
        <p style="margin:0 0 48px;font-size:13px;color:#64748b">Pour la maîtrise d'œuvre</p>
        <p style="margin:0"><strong>{{nom_moe}}</strong></p>
      </td>
    </tr>
  </table>
</div>`;

export const DEFAULT_AE_BODY_HTML = `<div style="font-family:'Segoe UI',Arial,sans-serif;color:#111827;line-height:1.55">
  <p style="text-align:right;margin:0 0 8px;color:#64748b;font-size:13px">{{date_jour}}</p>
  <h1 style="text-align:center;font-size:20px;margin:0 0 24px;letter-spacing:0.04em">ACTE D'ENGAGEMENT</h1>

  <p>Le présent acte d'engagement est conclu entre :</p>

  <p style="margin-top:16px"><strong>Le maître d'ouvrage</strong><br/>
  {{nom_maitre_ouvrage}}<br/>
  {{adresse_maitre_ouvrage}}<br/>
  Représenté par {{signataire_maitre_ouvrage}}</p>

  <p style="margin-top:16px"><strong>Et l'entreprise</strong><br/>
  {{nom_entreprise}}<br/>
  {{adresse_entreprise}} — SIRET {{siret_entreprise}}<br/>
  Représentée par {{signataire_entreprise}}</p>

  <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0" />

  <p><strong>Opération :</strong> {{nom_operation}}</p>
  <p><strong>Adresse :</strong> {{adresse_operation}}, {{code_postal_operation}} {{ville_operation}}</p>
  <p><strong>Maîtrise d'œuvre :</strong> {{nom_moe}}</p>
  <p><strong>Lot n° {{lot_numero}}</strong> — {{lot_designation}}</p>

  <h2 style="font-size:15px;margin:24px 0 8px">Engagement financier</h2>
  <p>L'entreprise s'engage à réaliser les travaux du lot ci-dessus pour un montant de :</p>
  <p><strong>{{montant_marche_ht}} HT</strong> soit <strong>{{montant_marche_ttc}} TTC</strong> (TVA {{taux_tva}}).</p>
  <p><strong>Délai de paiement :</strong> {{delai_paiement}}</p>

  <p style="margin-top:28px">Fait à {{ville_operation}}, le {{date_jour}}, en deux exemplaires.</p>

  <table style="width:100%;margin-top:36px;border-collapse:collapse">
    <tr>
      <td style="width:50%;vertical-align:top;padding-right:16px">
        <p style="margin:0 0 48px;font-size:13px;color:#64748b">Le maître d'ouvrage</p>
        <p style="margin:0"><strong>{{signataire_maitre_ouvrage}}</strong></p>
      </td>
      <td style="width:50%;vertical-align:top;padding-left:16px">
        <p style="margin:0 0 48px;font-size:13px;color:#64748b">L'entreprise</p>
        <p style="margin:0"><strong>{{signataire_entreprise}}</strong><br/>{{nom_entreprise}}</p>
      </td>
    </tr>
  </table>
</div>`;

export function buildExampleLabelValues(
  labels: DocumentLabelDefinition[]
): Record<string, string> {
  return Object.fromEntries(labels.map((item) => [item.key, item.example]));
}

export function applyDocumentLabels(
  template: string,
  values: Record<string, string>
) {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key: string) => {
    const normalized = key.toLowerCase();
    return values[normalized] ?? "";
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Aperçu avec valeurs d'exemple, étiquettes inconnues laissées visibles. */
export function renderDocumentPreviewHtml(
  template: string,
  labels: DocumentLabelDefinition[],
  mode: "filled" | "labels"
) {
  const byKey = new Map(labels.map((item) => [item.key, item]));

  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key: string) => {
    const normalized = key.toLowerCase();
    const def = byKey.get(normalized);
    if (mode === "labels") {
      const label = def?.label ?? normalized;
      return `<span class="doc-label-chip" title="${escapeHtml(def?.description ?? normalized)}">${escapeHtml(label)}</span>`;
    }
    const value = def?.example ?? `{{${normalized}}}`;
    return `<span class="doc-label-value">${escapeHtml(value)}</span>`;
  });
}

export function normalizeLabelKey(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export function isValidLabelKey(key: string) {
  return /^[a-z][a-z0-9_]*$/.test(key);
}

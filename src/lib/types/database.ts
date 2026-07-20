export type Project = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  typology: string | null;
  client_name: string | null;
  client_address: string | null;
  default_payment_terms: string | null;
  operation_photo_path: string | null;
  sharepoint_plan_exe_path: string | null;
  is_operation_configured: boolean;
  // Maître d'ouvrage (renseigné par DANOBAT)
  owner_name: string | null;
  owner_address: string | null;
  owner_postal_code: string | null;
  owner_city: string | null;
  owner_email_admin: string | null;
  owner_email_works: string | null;
  owner_signatory_name: string | null;
  owner_signatory_email: string | null;
  owner_logo_path: string | null;
  owner_doc_marche: boolean;
  owner_doc_os: boolean;
  owner_doc_ae: boolean;
  owner_doc_avenant: boolean;
  // Maître d'œuvre (DANOBAT)
  moe_address: string | null;
  moe_postal_code: string | null;
  moe_city: string | null;
  moe_email_admin: string | null;
  moe_email_works: string | null;
  moe_logo_path: string | null;
  created_at: string;
  updated_at: string;
};

export type EnterpriseEmailInvitation = {
  id: string;
  enterprise_id: string;
  email: string;
  sent_at: string;
  sent_by: string | null;
};

export type Enterprise = {
  id: string;
  project_id: string;
  name: string;
  trade: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  lot_number: string | null;
  designation: string | null;
  enterprise_address: string | null;
  enterprise_postal_code: string | null;
  enterprise_city: string | null;
  contract_amount_ht: number;
  prorata_percent: number;
  payment_terms: string | null;
  vat_rate: number;
  avancement_max_avant_dgd: number;
  sort_order: number;
  email_chantier: string | null;
  email_factures: string | null;
  email_administratif: string | null;
  email_comptabilite: string | null;
  email_travaux: string | null;
  email_bureau_etudes: string | null;
  email_signataire: string | null;
  email_sav: string | null;
  signataire_name: string | null;
  siret: string | null;
  phone_accueil: string | null;
  phone_travaux: string | null;
  logo_path: string | null;
  has_bank_guarantee: boolean;
  sharepoint_folder_name: string | null;
  created_at: string;
  updated_at: string;
};

/** Entrée de la base de données d'entreprises réutilisable (auto-remplissage). */
export type CompanyDirectoryEntry = {
  id: string;
  siret: string | null;
  name: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  email_administratif: string | null;
  email_comptabilite: string | null;
  email_travaux: string | null;
  email_bureau_etudes: string | null;
  email_signataire: string | null;
  signataire_name: string | null;
  email_sav: string | null;
  phone_accueil: string | null;
  phone_travaux: string | null;
  logo_path: string | null;
  created_at: string;
  updated_at: string;
};

/** Entrée de la base maîtres d'ouvrage réutilisable (auto-remplissage). */
export type OwnerDirectoryEntry = {
  id: string;
  name: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  email_admin: string | null;
  email_works: string | null;
  signatory_name: string | null;
  signatory_email: string | null;
  logo_path: string | null;
  doc_marche: boolean;
  doc_os: boolean;
  doc_ae: boolean;
  doc_avenant: boolean;
  created_at: string;
  updated_at: string;
};

/** Étiquette dynamique pour modèles OS / acte d'engagement. */
export type DocumentLabel = {
  id: string;
  key: string;
  label: string;
  description: string;
  example: string;
  category: string;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Modèle de document métier lié à un maître d'ouvrage. */
export type OwnerDocumentTemplate = {
  id: string;
  owner_id: string;
  doc_type: "os" | "ae";
  title: string;
  body_html: string;
  enabled_label_keys: string[];
  source_file_path: string | null;
  source_file_name: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FinancialBankGuarantee = {
  id: string;
  project_id: string;
  company_name: string;
  amount_ht: number;
  notes: string | null;
  created_at: string;
};

export type AmendmentType = "ts" | "tma";

export type AmendmentSignatureStatus =
  | "chez_entreprise"
  | "chez_mou"
  | "valide_classe";

export type FinancialAmendment = {
  id: string;
  enterprise_id: string;
  amendment_number: number;
  designation: string | null;
  os_number: string | null;
  amount_ht: number;
  amount_ttc: number;
  amendment_type: AmendmentType;
  signature_status: AmendmentSignatureStatus;
  internal_comment: string | null;
  created_at: string;
  updated_at: string;
};

export type FinancialSituation = {
  id: string;
  enterprise_id: string;
  situation_number: number;
  situation_date: string;
  works_cumulative_ht: number;
  amendment_works_cumulative_ht: number;
  prorata_cumulative_ht: number;
  retention_guarantee_cumulative_ht: number;
  retention_finition_cumulative_ht: number;
  retention_diverse_cumulative_ht: number;
  penalties_cumulative_ht: number;
  cie_cumulative_ht: number;
  notes: string | null;
  invoice_file_path: string | null;
  invoice_file_name: string | null;
  created_at: string;
  updated_at: string;
  delegations?: FinancialSituationDelegation[];
};

export type FinancialSituationDelegation = {
  id: string;
  situation_id: string;
  company_name: string;
  delegation_type: "subcontractor" | "supplier";
  delegation_amount: number;
  cumulative_ttc: number;
  previous_cumulative_ttc: number;
  sort_order: number;
  created_at: string;
};

export type FinancialAuditLog = {
  id: string;
  project_id: string;
  enterprise_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  summary: string | null;
  created_at: string;
};

export type IncomingFileCategory =
  | "facture"
  | "devis"
  | "administratif"
  | "chantier"
  | "plan_exe"
  | "autre";

export const INCOMING_FILE_CATEGORY_LABELS: Record<IncomingFileCategory, string> = {
  facture: "Facture",
  devis: "Devis",
  administratif: "Administratif",
  chantier: "Chantier",
  plan_exe: "Plan d'exé",
  autre: "Autre",
};

export type IncomingFile = {
  id: string;
  project_id: string;
  enterprise_id: string | null;
  situation_id: string | null;
  category: IncomingFileCategory;
  file_path: string;
  file_name: string;
  storage_provider: "supabase" | "sharepoint";
  external_url: string | null;
  external_item_id: string | null;
  source_email: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type IncomingFileWithDetails = IncomingFile & {
  enterprise_name: string | null;
  lot_number: string | null;
  situation_number: number | null;
};

export type SituationLine = {
  label: string;
  cumulative: number;
  previous: number;
  period: number;
};

export type ComputedSituation = {
  advancementPercent: number;
  contractAmountHt: number;
  contractAmountTtc: number;
  amendmentsTotalHt: number;
  amendmentsTotalTtc: number;
  totalMarketHt: number;
  totalMarketTtc: number;
  lines: SituationLine[];
  subtotalHt: number;
  subtotalPreviousHt: number;
  subtotalPeriodHt: number;
  totalHt: number;
  totalPreviousHt: number;
  totalPeriodHt: number;
  vatAmount: number;
  vatPreviousAmount: number;
  vatPeriodAmount: number;
  totalTtc: number;
  totalPreviousTtc: number;
  totalPeriodTtc: number;
  bankGuaranteeHt: number;
  bankGuaranteeTtc: number;
};

export type LotWithFinancials = Enterprise & {
  amendments: FinancialAmendment[];
  situations: FinancialSituation[];
};

export type ProjectFinancialData = Project & {
  enterprises: LotWithFinancials[];
  bank_guarantees?: FinancialBankGuarantee[];
};

export type PlanFolder = {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  created_at: string;
};

export type Plan = {
  id: string;
  project_id: string;
  folder_id: string | null;
  plan_type_id: string | null;
  name: string;
  file_path: string;
  file_size: number | null;
  sort_order: number;
  created_at: string;
};

export type VisitPhase = {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type PhaseZone = {
  id: string;
  phase_id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type ControlLibraryItem = {
  id: string;
  phase_name: string;
  zone_name: string;
  label: string;
  plan_support_name: string;
  help_comment: string;
  preset_comments: string[];
  sort_order: number;
  created_at: string;
};

export type VisitStatus = "in_progress" | "completed";

export type Visit = {
  id: string;
  project_id: string;
  phase_id: string | null;
  zone_id: string | null;
  checklist_item_id: string | null;
  title: string | null;
  visit_date: string;
  status: VisitStatus;
  control_summary: VisitControlSummary | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MarkerStatus =
  | "a_traiter"
  | "en_cours"
  | "rejetee"
  | "levee"
  | "constat";

export const MARKER_STATUS_LABELS: Record<MarkerStatus, string> = {
  a_traiter: "À traiter",
  en_cours: "En cours",
  rejetee: "Rejetée",
  levee: "Levée",
  constat: "Constat",
};

export const MARKER_STATUS_COLORS: Record<MarkerStatus, string> = {
  a_traiter: "bg-red-600",
  en_cours: "bg-amber-500",
  rejetee: "bg-zinc-500",
  levee: "bg-emerald-600",
  constat: "bg-blue-500",
};

export const MARKER_STATUS_HEX: Record<MarkerStatus, string> = {
  a_traiter: "#dc2626",
  en_cours: "#f59e0b",
  rejetee: "#71717a",
  levee: "#059669",
  constat: "#2563eb",
};

export const DRAW_COLOR_PRESETS = [
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#000000",
] as const;

export const DRAW_WIDTH_PRESETS = [1.5, 2.5, 4, 6, 8] as const;

export type ProjectLocation = {
  id: string;
  project_id: string;
  name: string;
  is_preset: boolean;
  created_by: string | null;
  created_at: string;
};

export type DrawingPoint = {
  x: number;
  y: number;
};

export type DrawingStroke = {
  points: DrawingPoint[];
  color: string;
  width: number;
};

export type PlanDrawing = {
  id: string;
  visit_id: string;
  phase_id: string | null;
  plan_id: string;
  page_number: number;
  strokes: DrawingStroke[];
  created_at: string;
  updated_at: string;
};

export type ControlResult = "ok" | "ko" | "deferred" | "pending";

export const CONTROL_RESULT_LABELS: Record<ControlResult, string> = {
  ok: "Conforme",
  ko: "À lever",
  deferred: "À contrôler plus tard",
  pending: "En attente",
};

export const CONTROL_RESULT_COLORS: Record<
  ControlResult,
  { bg: string; text: string; hex: string }
> = {
  ok: { bg: "bg-emerald-600", text: "text-white", hex: "#059669" },
  ko: { bg: "bg-red-600", text: "text-white", hex: "#dc2626" },
  deferred: { bg: "bg-blue-600", text: "text-white", hex: "#2563eb" },
  pending: { bg: "bg-amber-400", text: "text-zinc-900", hex: "#fbbf24" },
};

/** Couleur pastille plan / liste tablette selon le résultat de contrôle. */
export function markerControlHex(
  controlResult: ControlResult | null | undefined,
  markerStatus?: MarkerStatus | null
): string {
  if (markerStatus === "levee") return "#2563eb";
  if (!controlResult) return "#fbbf24";
  if (controlResult === "ok") return "#059669";
  if (controlResult === "ko") return "#dc2626";
  if (controlResult === "pending") return "#fbbf24";
  if (controlResult === "deferred") return "#2563eb";
  return "#a1a1aa";
}

/** Statuts terrain affichés sur tablette (4 couleurs). */
export type TabletMarkerVisualState = "ko" | "ok" | "levee" | "pending";

export const TABLET_MARKER_STATE_LABELS: Record<TabletMarkerVisualState, string> = {
  ko: "À lever",
  ok: "Conforme",
  levee: "Levée",
  pending: "En attente",
};

export function getTabletMarkerVisualState(
  controlResult: ControlResult | null | undefined,
  markerStatus: MarkerStatus | null | undefined
): TabletMarkerVisualState {
  if (markerStatus === "levee") return "levee";
  if (controlResult === "ok") return "ok";
  if (controlResult === "ko") return "ko";
  return "pending";
}

export const PLAN_SUPPORT_OPTIONS = [
  "Plans architecte",
  "Plans béton",
  "Plans électricité (ELEX)",
  "Plans plomberie",
  "Autres plans",
] as const;

export type VisitControlSummary = "pending" | "ok" | "partial" | "ko";

export const VISIT_CONTROL_SUMMARY_LABELS: Record<VisitControlSummary, string> = {
  pending: "En cours",
  ok: "Conforme",
  partial: "Partiellement conforme",
  ko: "Non conforme",
};

export type ChecklistItemStatus = "pending" | "ok" | "partial" | "ko";

export const CHECKLIST_STATUS_LABELS: Record<ChecklistItemStatus, string> = {
  pending: "À contrôler",
  ok: "Conforme",
  partial: "Partiel",
  ko: "Non conforme",
};

export type PhaseChecklistItem = {
  id: string;
  phase_id: string;
  zone_id: string | null;
  zone_name: string | null;
  label: string;
  sort_order: number;
  plan_type_id: string | null;
  library_item_id: string | null;
  help_comment: string;
  preset_comments: string[];
  created_at: string;
};

export type VisitChecklistResponse = {
  id: string;
  visit_id: string;
  checklist_item_id: string;
  status: ChecklistItemStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Marker = {
  id: string;
  visit_id: string;
  phase_id: string | null;
  plan_id: string;
  page_number: number;
  x_percent: number;
  y_percent: number;
  remark: string | null;
  photo_path: string | null;
  marker_number: number;
  status: MarkerStatus;
  enterprise_id: string | null;
  trade: string | null;
  location_label: string | null;
  location_preset_id: string | null;
  checklist_item_id: string | null;
  plan_level_id: string | null;
  control_result: ControlResult | null;
  created_at: string;
  updated_at: string;
};

export type MarkerLink = {
  id: string;
  from_marker_id: string;
  to_marker_id: string;
};

export type MarkerWithLinks = Marker & {
  linked_marker_ids: string[];
};

export type VisitWithMarkers = Visit & {
  markers: MarkerWithLinks[];
};

export type ProjectWithEnterprises = Project & {
  enterprises: Enterprise[];
};

export type ProjectFormData = {
  name: string;
  address?: string;
  city?: string;
  postal_code?: string;
  description?: string;
  typology?: string;
  client_name?: string;
  client_address?: string;
  default_payment_terms?: string;
};

export type EnterpriseFormData = {
  name: string;
  trade?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
};

export type LotFormData = {
  lot_number: string;
  designation: string;
  name: string;
  enterprise_address?: string;
  contract_amount_ht: number;
  prorata_percent: number;
  payment_terms?: string;
  vat_rate?: number;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  email_chantier?: string;
  email_factures?: string;
  email_administratif?: string;
  has_bank_guarantee?: boolean;
};

export type AmendmentFormData = {
  amendment_number: number;
  designation?: string;
  os_number?: string;
  amount_ht: number;
  amendment_type?: AmendmentType;
  signature_status?: AmendmentSignatureStatus;
  internal_comment?: string;
};

export type SituationFormData = {
  situation_number: number;
  situation_date: string;
  works_cumulative_ht: number;
  amendment_works_cumulative_ht?: number;
  prorata_cumulative_ht?: number;
  retention_guarantee_cumulative_ht?: number;
  retention_finition_cumulative_ht?: number;
  retention_diverse_cumulative_ht?: number;
  penalties_cumulative_ht?: number;
  cie_cumulative_ht?: number;
  notes?: string;
};

export type DelegationFormData = {
  company_name: string;
  delegation_type: "subcontractor" | "supplier";
  delegation_amount: number;
  cumulative_ttc: number;
  previous_cumulative_ttc?: number;
};

export type VisitFormData = {
  title?: string;
  visit_date?: string;
  notes?: string;
  phase_id?: string;
  zone_id?: string;
  checklist_item_id?: string;
};

export type MarkerFormData = {
  plan_id: string;
  page_number?: number;
  x_percent: number;
  y_percent: number;
  remark?: string;
};

export type MarkerUpdateData = {
  remark?: string;
  linked_marker_ids?: string[];
  status?: MarkerStatus;
  enterprise_id?: string | null;
  trade?: string | null;
  location_label?: string | null;
  location_preset_id?: string | null;
  checklist_item_id?: string | null;
  plan_level_id?: string | null;
  control_result?: ControlResult | null;
  preset_comment?: string | null;
  /** Pastille d'une visite antérieure : déverrouille l'édition complète. */
  unlock_edit?: boolean;
  /** Lever la pastille uniquement (visite antérieure). */
  resolve_only?: boolean;
};

export type GlobalRole = "super_admin" | "user";

/** danobat = PC + tablette ; entreprise = portail sous-traitant uniquement */
export type AccountKind = "danobat" | "entreprise";

export type ProjectRole =
  | "admin"
  | "gestionnaire"
  | "financier"
  | "terrain"
  | "lecture"
  | "entreprise";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  global_role: GlobalRole;
  account_kind: AccountKind;
  notify_new_projects: boolean;
  email_signature_html: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectFavorite = {
  id: string;
  user_id: string;
  project_id: string;
  created_at: string;
};

export type UserM365Connection = {
  user_id: string;
  ms_user_id: string;
  ms_email: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  connected_at: string;
  updated_at: string;
};

export type ProjectMember = {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  enterprise_id: string | null;
  created_at: string;
};

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  admin: "Administrateur",
  gestionnaire: "Gestionnaire",
  financier: "Financier",
  terrain: "Terrain",
  lecture: "Lecture seule",
  entreprise: "Entreprise (sous-traitant)",
};

export const PROJECT_ROLE_DESCRIPTIONS: Record<ProjectRole, string> = {
  admin: "Accès complet et gestion des membres",
  gestionnaire: "Édition complète du projet, visites et finances",
  financier: "Accès au suivi financier uniquement",
  terrain: "Visites, plans et checklist sur le terrain",
  lecture: "Consultation sans modification",
  entreprise: "Dépôt de demandes de sous-traitance sur le chantier partagé",
};

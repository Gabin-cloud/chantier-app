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
  created_at: string;
  updated_at: string;
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
  contract_amount_ht: number;
  prorata_percent: number;
  payment_terms: string | null;
  vat_rate: number;
  sort_order: number;
  email_chantier: string | null;
  email_factures: string | null;
  email_administratif: string | null;
  has_bank_guarantee: boolean;
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

export type FinancialAmendment = {
  id: string;
  enterprise_id: string;
  amendment_number: number;
  designation: string | null;
  os_number: string | null;
  amount_ht: number;
  amount_ttc: number;
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

export type Plan = {
  id: string;
  project_id: string;
  name: string;
  file_path: string;
  file_size: number | null;
  sort_order: number;
  created_at: string;
};

export type VisitStatus = "in_progress" | "completed";

export type Visit = {
  id: string;
  project_id: string;
  title: string | null;
  visit_date: string;
  status: VisitStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Marker = {
  id: string;
  visit_id: string;
  plan_id: string;
  page_number: number;
  x_percent: number;
  y_percent: number;
  remark: string | null;
  photo_path: string | null;
  marker_number: number;
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
};

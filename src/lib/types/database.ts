export type Project = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
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
  created_at: string;
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
};

export type EnterpriseFormData = {
  name: string;
  trade?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
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

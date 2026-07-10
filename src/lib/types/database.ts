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

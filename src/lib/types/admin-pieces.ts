import type { AdminPieceStatus } from "@/lib/admin-pieces/status";
import type { Enterprise } from "@/lib/types/database";

export type AdminPieceTemplate = {
  id: string;
  name: string;
  control_notes: string;
  sort_order: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

export type ProjectAdminPiece = {
  id: string;
  project_id: string;
  template_id: string | null;
  piece_key: string;
  name: string;
  control_notes: string;
  sort_order: number;
  is_os: boolean;
  is_ae: boolean;
  created_at: string;
  updated_at: string;
};

export type EnterpriseAdminSubmission = {
  id: string;
  project_id: string;
  enterprise_id: string;
  project_admin_piece_id: string;
  status: AdminPieceStatus;
  file_path: string | null;
  file_name: string | null;
  rejection_comment: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminPieceCell = {
  piece: ProjectAdminPiece;
  submission: EnterpriseAdminSubmission | null;
  status: AdminPieceStatus;
};

export type AdminSyntheseRow = {
  enterprise: Enterprise;
  cells: AdminPieceCell[];
  osAeStatus: AdminPieceStatus;
  otherPiecesStatus: AdminPieceStatus;
};

export type AdminSyntheseData = {
  pieces: ProjectAdminPiece[];
  rows: AdminSyntheseRow[];
};

export type EnterpriseAdminControlData = {
  enterprise: Enterprise;
  pieces: Array<
    AdminPieceCell & {
      fileUrl: string | null;
    }
  >;
};

export type AdminPieceStatus = "pending" | "submitted" | "validated" | "rejected";

export type AdminPieceCellStatus = AdminPieceStatus;

/** Priorité pour agréger plusieurs pièces : rouge > bleu > jaune > vert. */
const STATUS_PRIORITY: Record<AdminPieceStatus, number> = {
  rejected: 0,
  submitted: 1,
  pending: 2,
  validated: 3,
};

export function aggregateAdminPieceStatuses(
  statuses: AdminPieceStatus[]
): AdminPieceStatus {
  if (statuses.length === 0) return "pending";
  return statuses.reduce((worst, current) =>
    STATUS_PRIORITY[current] < STATUS_PRIORITY[worst] ? current : worst
  );
}

export const ADMIN_PIECE_STATUS_LABELS: Record<AdminPieceStatus, string> = {
  pending: "Non transmis",
  submitted: "À contrôler",
  validated: "Validé",
  rejected: "Refusé — à redéposer",
};

export const ADMIN_PIECE_STATUS_COLORS: Record<
  AdminPieceStatus,
  { bg: string; ring: string; title: string }
> = {
  validated: {
    bg: "bg-emerald-500",
    ring: "ring-emerald-100",
    title: "Validé",
  },
  pending: {
    bg: "bg-amber-400",
    ring: "ring-amber-100",
    title: "Non transmis par l'entreprise",
  },
  submitted: {
    bg: "bg-blue-500",
    ring: "ring-blue-100",
    title: "Transmis — à contrôler par DANOBAT",
  },
  rejected: {
    bg: "bg-red-500",
    ring: "ring-red-100",
    title: "Refusé — à redéposer",
  },
};

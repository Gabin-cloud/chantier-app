import {
  ADMIN_PIECE_STATUS_COLORS,
  type AdminPieceStatus,
} from "@/lib/admin-pieces/status";

type AdminPieceStatusBadgeProps = {
  status: AdminPieceStatus;
  title?: string;
  size?: "sm" | "md";
};

export function AdminPieceStatusBadge({
  status,
  title,
  size = "md",
}: AdminPieceStatusBadgeProps) {
  const colors = ADMIN_PIECE_STATUS_COLORS[status];
  const dimension = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  return (
    <span
      title={title ?? colors.title}
      className={`inline-block shrink-0 rounded-full ring-2 ${dimension} ${colors.bg} ${colors.ring}`}
      aria-label={colors.title}
    />
  );
}

export function AdminPieceStatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
      <span className="inline-flex items-center gap-1.5">
        <AdminPieceStatusBadge status="validated" size="sm" /> Validé
      </span>
      <span className="inline-flex items-center gap-1.5">
        <AdminPieceStatusBadge status="pending" size="sm" /> Non transmis
      </span>
      <span className="inline-flex items-center gap-1.5">
        <AdminPieceStatusBadge status="submitted" size="sm" /> À contrôler
      </span>
      <span className="inline-flex items-center gap-1.5">
        <AdminPieceStatusBadge status="rejected" size="sm" /> Refusé
      </span>
    </div>
  );
}

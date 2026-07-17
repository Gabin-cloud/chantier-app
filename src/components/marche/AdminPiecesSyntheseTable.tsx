"use client";

import Link from "next/link";
import {
  AdminPieceStatusBadge,
  AdminPieceStatusLegend,
} from "@/components/marche/AdminPieceStatusBadge";
import { aggregateAdminPieceStatuses } from "@/lib/admin-pieces/status";
import type { AdminSyntheseData } from "@/lib/types/admin-pieces";

type AdminPiecesSyntheseTableProps = {
  projectId: string;
  data: AdminSyntheseData;
};

const th =
  "border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600";
const td = "border border-slate-200 px-2 py-1 text-xs text-slate-700";

export function AdminPiecesSyntheseTable({
  projectId,
  data,
}: AdminPiecesSyntheseTableProps) {
  const { pieces, rows } = data;
  const otherPieces = pieces.filter((p) => !p.is_os && !p.is_ae);

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-900">
          Synthèse administrative par lot
        </h2>
        <AdminPieceStatusLegend />
      </header>

      {rows.length === 0 ? (
        <p className="px-3 py-6 text-sm text-slate-500">
          Aucun lot configuré. Ajoutez des entreprises dans la fiche opération.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr>
                <th className={`${th} bg-slate-100`} colSpan={3}>
                  Entreprise
                </th>
                <th className={`${th} bg-amber-50`} colSpan={pieces.length + 1}>
                  Pièces administratives
                </th>
              </tr>
              <tr className="bg-slate-50">
                <th className={th}>N° lot</th>
                <th className={th}>Lot</th>
                <th className={th}>Entreprise</th>
                {pieces.map((piece) => (
                  <th key={piece.id} className={`${th} min-w-[72px] text-center`}>
                    {piece.name}
                  </th>
                ))}
                <th className={`${th} min-w-[80px] text-center`}>Pièces admin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const recapStatus =
                  otherPieces.length > 0
                    ? aggregateAdminPieceStatuses(
                        row.cells
                          .filter((c) => !c.piece.is_os && !c.piece.is_ae)
                          .map((c) => c.status)
                      )
                    : "validated";

                return (
                  <tr key={row.enterprise.id} className="hover:bg-slate-50/60">
                    <td className={`${td} text-center font-medium`}>
                      {row.enterprise.lot_number ?? "—"}
                    </td>
                    <td className={td}>{row.enterprise.designation ?? "—"}</td>
                    <td className={`${td} font-medium text-slate-900`}>
                      <Link
                        href={`/pc/projets/${projectId}/marche/pieces?enterprise=${row.enterprise.id}`}
                        className="text-violet-700 hover:underline"
                      >
                        {row.enterprise.name}
                      </Link>
                    </td>
                    {row.cells.map((cell) => (
                      <td key={cell.piece.id} className={`${td} text-center`}>
                        <AdminPieceStatusBadge status={cell.status} />
                      </td>
                    ))}
                    <td className={`${td} text-center`}>
                      {otherPieces.length > 0 ? (
                        <AdminPieceStatusBadge status={recapStatus} />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

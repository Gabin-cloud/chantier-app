"use client";

import Link from "next/link";
import type { ControlBoardRow } from "@/lib/actions/checklist";
import { CONTROL_RESULT_LABELS } from "@/lib/types/database";

const RESULT_COLORS: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-800",
  partial: "bg-amber-100 text-amber-800",
  ko: "bg-red-100 text-red-800",
};

export function ControlBoardTable({
  rows,
  projectId,
}: {
  rows: ControlBoardRow[];
  projectId: string;
}) {
  const phases = [...new Set(rows.map((r) => r.phaseName))];

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Aucun point de contrôle défini. Ajoutez-les dans les paramètres du projet.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {phases.map((phaseName) => {
        const phaseRows = rows.filter((r) => r.phaseName === phaseName);
        const zones = [...new Set(phaseRows.map((r) => r.zoneName))];

        return (
          <section key={phaseName} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="text-lg font-semibold text-slate-900">{phaseName}</h2>
            </div>

            {zones.map((zoneName) => {
              const zoneRows = phaseRows.filter((r) => r.zoneName === zoneName);
              return (
                <div key={zoneName} className="border-b border-slate-100 last:border-b-0">
                  <div className="bg-slate-100/70 px-4 py-2 text-sm font-semibold text-slate-700">
                    {zoneName}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-white text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Point de contrôle</th>
                          <th className="px-4 py-3 font-semibold">Dernier contrôle</th>
                          <th className="px-4 py-3 font-semibold">Résultat</th>
                          <th className="px-4 py-3 font-semibold">Entreprise</th>
                          <th className="px-4 py-3 font-semibold">Localisation</th>
                          <th className="px-4 py-3 font-semibold">Visite</th>
                        </tr>
                      </thead>
                      <tbody>
                        {zoneRows.map((row) => (
                          <tr key={row.itemId} className="border-t border-slate-100">
                            <td className="px-4 py-3 font-medium text-slate-900">{row.itemLabel}</td>
                            <td className="px-4 py-3 text-slate-600">
                              {row.lastControlDate
                                ? new Date(row.lastControlDate).toLocaleDateString("fr-FR")
                                : "—"}
                            </td>
                            <td className="px-4 py-3">
                              {row.controlResult ? (
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    RESULT_COLORS[row.controlResult] ?? "bg-slate-100"
                                  }`}
                                >
                                  {CONTROL_RESULT_LABELS[row.controlResult]}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{row.enterpriseName ?? "—"}</td>
                            <td className="px-4 py-3 text-slate-600">{row.location ?? "—"}</td>
                            <td className="px-4 py-3">
                              {row.visitId ? (
                                <Link
                                  href={`/tablette/projets/${projectId}/visites/${row.visitId}`}
                                  className="font-medium text-emerald-700 hover:underline"
                                >
                                  Voir
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

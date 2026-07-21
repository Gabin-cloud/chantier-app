"use client";

import { formatCurrency } from "@/lib/finance/calculations";
import type { LotWithFinancials, Project } from "@/lib/types/database";

type ProrataPanelProps = {
  project: Project;
  lots: LotWithFinancials[];
};

function formatProrataPercent(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(value);
}

export function ProrataPanel({ project, lots }: ProrataPanelProps) {
  let totalRetenue = 0;

  const rows = lots.map((lot) => {
    const latest = lot.situations?.[lot.situations.length - 1];
    const prorataPercent = Number(lot.prorata_percent);
    const retenueHt = latest ? Number(latest.prorata_cumulative_ht) : 0;
    const retenueTtc = retenueHt * (1 + Number(lot.vat_rate) / 100);
    totalRetenue += retenueHt;

    return {
      lot,
      prorataPercent,
      retenueHt,
      retenueTtc,
      latestDate: latest?.situation_date ?? null,
    };
  });

  return (
    <section className="overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Suivi ProRata</h2>
      <p className="mb-4 text-sm text-slate-500">{project.name}</p>

      {lots.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun lot configuré.</p>
      ) : (
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-3 py-2 font-medium">Lot</th>
              <th className="px-3 py-2 font-medium">Entreprise</th>
              <th className="px-3 py-2 font-medium text-right">% Prorata</th>
              <th className="px-3 py-2 font-medium text-right">Retenue cumulée H.T.</th>
              <th className="px-3 py-2 font-medium text-right">Retenue cumulée T.T.C.</th>
              <th className="px-3 py-2 font-medium">Dernière situation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ lot, prorataPercent, retenueHt, retenueTtc, latestDate }) => (
              <tr key={lot.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium whitespace-nowrap">
                  {lot.lot_number}
                </td>
                <td className="px-3 py-2">{lot.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatProrataPercent(prorataPercent)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {retenueHt !== 0 ? formatCurrency(retenueHt) : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {retenueTtc !== 0 ? formatCurrency(retenueTtc) : "—"}
                </td>
                <td className="px-3 py-2">
                  {latestDate
                    ? new Date(latestDate).toLocaleDateString("fr-FR")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td colSpan={3} className="px-3 py-3">
                Total retenue cumulée H.T.
              </td>
              <td className="px-3 py-3 text-right">
                {formatCurrency(totalRetenue)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}

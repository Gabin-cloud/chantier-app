import { ActionDot } from "@/components/ui/ActionDot";
import {
  computeAmendmentsTotals,
  formatCurrency,
  formatPercent,
} from "@/lib/finance/calculations";
import type { LotWithFinancials } from "@/lib/types/database";

type OperationDashboardTableProps = {
  lots: LotWithFinancials[];
};

/** Pastille verte (tâche terminée) ou croix rouge (tâche non terminée). */
function StatusCheck({ done, title }: { done: boolean; title: string }) {
  return (
    <span
      title={title}
      className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold leading-none text-white ${
        done ? "bg-emerald-500" : "bg-red-500"
      }`}
    >
      {done ? "✓" : "✗"}
    </span>
  );
}

const th =
  "border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600";
const td = "border border-slate-200 px-2 py-1 text-xs text-slate-700";

export function OperationDashboardTable({ lots }: OperationDashboardTableProps) {
  const rows = lots.map((lot) => {
    const contractHt = Number(lot.contract_amount_ht) || 0;
    const { totalHt: amendmentsHt } = computeAmendmentsTotals(lot.amendments);
    const totalHt = contractHt + amendmentsHt;
    const latest = lot.situations[lot.situations.length - 1];
    const worksCum = latest
      ? Number(latest.works_cumulative_ht) +
        Number(latest.amendment_works_cumulative_ht)
      : 0;
    const advancement = totalHt > 0 ? worksCum / totalHt : 0;
    return {
      lot,
      contractHt,
      amendmentsHt,
      totalHt,
      worksCum,
      advancement,
      hasSituations: lot.situations.length > 0,
      hasAmendments: lot.amendments.length > 0,
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.contractHt += r.contractHt;
      acc.amendmentsHt += r.amendmentsHt;
      acc.totalHt += r.totalHt;
      acc.worksCum += r.worksCum;
      return acc;
    },
    { contractHt: 0, amendmentsHt: 0, totalHt: 0, worksCum: 0 }
  );
  const totalAdvancement =
    totals.totalHt > 0 ? totals.worksCum / totals.totalHt : 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-900">
          Tableau de bord général
        </h2>
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <StatusCheck done title="" /> Terminé
          </span>
          <span className="inline-flex items-center gap-1">
            <StatusCheck done={false} title="" /> En cours / à faire
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500 ring-2 ring-blue-100" />
            Action attendue de notre part
          </span>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="px-3 py-6 text-sm text-slate-500">
          Aucun lot configuré pour cette opération. Ajoutez des lots dans le suivi
          financier.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse">
            <thead>
              <tr>
                <th className={`${th} bg-slate-100`} colSpan={3}>
                  Entreprise
                </th>
                <th className={`${th} bg-amber-50`} colSpan={4}>
                  Administratifs
                </th>
                <th className={`${th} bg-sky-50`} colSpan={4}>
                  Suivi financier
                </th>
                <th className={`${th} bg-emerald-50`} colSpan={3}>
                  Suivi travaux
                </th>
              </tr>
              <tr className="bg-slate-50">
                <th className={th}>N° Lot</th>
                <th className={th}>Lot</th>
                <th className={th}>Entreprise</th>
                <th className={th}>OS / AE</th>
                <th className={th}>Pièces admin</th>
                <th className={th}>Suivi assurance</th>
                <th className={th}>Sous-traitant</th>
                <th className={th}>Montant marché HT</th>
                <th className={th}>Montant avenant</th>
                <th className={th}>Marché + avenant</th>
                <th className={th}>% avanc. situations</th>
                <th className={th}>Conformités</th>
                <th className={th}>Non-conformités</th>
                <th className={th}>% non-conf.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.lot.id} className="hover:bg-slate-50/60">
                  <td className={`${td} text-center font-medium`}>
                    {r.lot.lot_number ?? "—"}
                  </td>
                  <td className={td}>{r.lot.designation ?? "—"}</td>
                  <td className={`${td} font-medium text-slate-900`}>
                    {r.lot.name}
                  </td>
                  <td className={`${td} text-center`}>
                    <StatusCheck
                      done={false}
                      title="Vert lorsque l'OS et l'AE sont signés par tous et diffusés à tout le monde"
                    />
                  </td>
                  <td className={`${td} text-center`}>
                    <StatusCheck
                      done={false}
                      title="Vert lorsque toutes les pièces administratives sont conformes"
                    />
                  </td>
                  <td className={`${td} text-center`}>
                    <StatusCheck
                      done={false}
                      title="Vert lorsque l'attestation d'assurance est à jour"
                    />
                  </td>
                  <td className={`${td} text-center`}>
                    <span className="text-slate-300">—</span>
                    {/* Emplacement prévu : pastille bleue si une action sous-traitant est attendue */}
                  </td>
                  <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                    {formatCurrency(r.contractHt)}
                  </td>
                  <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                    {formatCurrency(r.amendmentsHt)}
                    {r.hasAmendments && (
                      <ActionDot title="Un avenant est en attente de traitement de notre part" />
                    )}
                  </td>
                  <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                    {formatCurrency(r.totalHt)}
                  </td>
                  <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                    {formatPercent(r.advancement)}
                    {r.hasSituations && (
                      <ActionDot title="Une situation de travaux a été déposée" />
                    )}
                  </td>
                  <td className={`${td} text-center text-slate-300`}>—</td>
                  <td className={`${td} text-center text-slate-300`}>—</td>
                  <td className={`${td} text-center text-slate-300`}>—</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold text-slate-900">
                <td className={`${td} font-semibold`} colSpan={3}>
                  TOTAL
                </td>
                <td className={td} colSpan={4} />
                <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                  {formatCurrency(totals.contractHt)}
                </td>
                <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                  {formatCurrency(totals.amendmentsHt)}
                </td>
                <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                  {formatCurrency(totals.totalHt)}
                </td>
                <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                  {formatPercent(totalAdvancement)}
                </td>
                <td className={`${td} text-center text-slate-300`}>—</td>
                <td className={`${td} text-center text-slate-300`}>—</td>
                <td className={`${td} text-center text-slate-300`}>—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

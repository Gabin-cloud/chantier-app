import {
  computeAmendmentsTotals,
  computeContractTtc,
  formatCurrency,
} from "@/lib/finance/calculations";
import type { LotWithFinancials, Project } from "@/lib/types/database";

type MarketsRecapProps = {
  project: Project;
  lots: LotWithFinancials[];
};

export function MarketsRecap({ project, lots }: MarketsRecapProps) {
  let totalMarketHt = 0;
  let totalAmendmentsHt = 0;

  const rows = lots.map((lot) => {
    const amendments = lot.amendments ?? [];
    const { totalHt: amendmentsHt } = computeAmendmentsTotals(amendments);
    const contractHt = Number(lot.contract_amount_ht);
    const contractTtc = computeContractTtc(contractHt, Number(lot.vat_rate));

    totalMarketHt += contractHt;
    totalAmendmentsHt += amendmentsHt;

    const amendmentCells = Array.from({ length: 5 }, (_, i) => {
      const a = amendments.find((am) => am.amendment_number === i + 1);
      return a ? Number(a.amount_ht) : 0;
    });

    return {
      lot,
      contractHt,
      contractTtc,
      amendmentCells,
      totalHt: contractHt + amendmentsHt,
    };
  });

  return (
    <section className="overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-slate-900">
        Récapitulatif des marchés et avenants
      </h2>
      <p className="mb-4 text-sm text-slate-500">{project.name}</p>

      {lots.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucun lot configuré. Ajoutez des lots dans l&apos;onglet Lots &amp; marchés.
        </p>
      ) : (
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-2 py-2 font-medium">N°</th>
              <th className="px-2 py-2 font-medium">Désignation</th>
              <th className="px-2 py-2 font-medium">Titulaire</th>
              <th className="px-2 py-2 font-medium text-right">Marché HT</th>
              {Array.from({ length: 5 }, (_, i) => (
                <th key={i} className="px-2 py-2 font-medium text-right">
                  Avenant {i + 1}
                </th>
              ))}
              <th className="px-2 py-2 font-medium text-right">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ lot, contractHt, amendmentCells, totalHt }) => (
              <tr key={lot.id} className="border-b border-slate-100">
                <td className="px-2 py-2 font-medium">{lot.lot_number}</td>
                <td className="px-2 py-2">{lot.designation}</td>
                <td className="px-2 py-2">{lot.name}</td>
                <td className="px-2 py-2 text-right">{formatCurrency(contractHt)}</td>
                {amendmentCells.map((amount, i) => (
                  <td key={i} className="px-2 py-2 text-right text-slate-600">
                    {amount > 0 ? formatCurrency(amount) : "—"}
                  </td>
                ))}
                <td className="px-2 py-2 text-right font-semibold">
                  {formatCurrency(totalHt)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold text-slate-900">
              <td colSpan={3} className="px-2 py-3">
                Total opération
              </td>
              <td className="px-2 py-3 text-right">{formatCurrency(totalMarketHt)}</td>
              <td colSpan={5} className="px-2 py-3 text-right">
                Avenants : {formatCurrency(totalAmendmentsHt)}
              </td>
              <td className="px-2 py-3 text-right">
                {formatCurrency(totalMarketHt + totalAmendmentsHt)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}

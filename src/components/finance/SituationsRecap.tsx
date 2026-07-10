import Link from "next/link";
import {
  computeContractTtc,
  computeSituation,
  formatCurrency,
  formatDateFr,
} from "@/lib/finance/calculations";
import type { LotWithFinancials, Project } from "@/lib/types/database";

type SituationsRecapProps = {
  project: Project;
  lots: LotWithFinancials[];
};

export function SituationsRecap({ project, lots }: SituationsRecapProps) {
  let grandTotalPeriodHt = 0;
  let grandTotalPeriodTtc = 0;

  const rows = lots.flatMap((lot) => {
    const situations = lot.situations ?? [];
    const contractTtc = computeContractTtc(
      Number(lot.contract_amount_ht),
      Number(lot.vat_rate)
    );

    return situations.map((situation, index) => {
      const previous = index > 0 ? situations[index - 1] : null;
      const computed = computeSituation({
        contractAmountHt: Number(lot.contract_amount_ht),
        vatRate: Number(lot.vat_rate),
        prorataPercent: Number(lot.prorata_percent),
        amendments: lot.amendments ?? [],
        situation,
        previousSituation: previous,
        hasBankGuarantee: Boolean(lot.has_bank_guarantee),
      });

      grandTotalPeriodHt += computed.totalPeriodHt;
      grandTotalPeriodTtc += computed.totalPeriodTtc;

      return {
        lot,
        situation,
        computed,
        contractTtc,
      };
    });
  });

  return (
    <section className="overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-slate-900">
        Récapitulatif des situations de travaux
      </h2>
      <p className="mb-4 text-sm text-slate-500">{project.name}</p>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune situation enregistrée.</p>
      ) : (
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-2 py-2 font-medium">Lot</th>
              <th className="px-2 py-2 font-medium">Entreprise</th>
              <th className="px-2 py-2 font-medium">Situation</th>
              <th className="px-2 py-2 font-medium">Date</th>
              <th className="px-2 py-2 font-medium text-right">Marché T.T.C.</th>
              <th className="px-2 py-2 font-medium text-right">Cumul travaux H.T.</th>
              <th className="px-2 py-2 font-medium text-right">Du mois H.T.</th>
              <th className="px-2 py-2 font-medium text-right">Du mois T.T.C.</th>
              <th className="px-2 py-2 font-medium text-right">Cumul T.T.C.</th>
              <th className="px-2 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ lot, situation, computed, contractTtc }) => (
              <tr key={situation.id} className="border-b border-slate-100">
                <td className="px-2 py-2 font-medium">
                  {lot.lot_number} — {lot.designation}
                </td>
                <td className="px-2 py-2">{lot.name}</td>
                <td className="px-2 py-2">n°{situation.situation_number}</td>
                <td className="px-2 py-2">
                  {formatDateFr(situation.situation_date)}
                </td>
                <td className="px-2 py-2 text-right">
                  {formatCurrency(contractTtc)}
                </td>
                <td className="px-2 py-2 text-right">
                  {formatCurrency(Number(situation.works_cumulative_ht))}
                </td>
                <td className="px-2 py-2 text-right font-medium">
                  {formatCurrency(computed.totalPeriodHt)}
                </td>
                <td className="px-2 py-2 text-right font-medium text-blue-600">
                  {formatCurrency(computed.totalPeriodTtc)}
                </td>
                <td className="px-2 py-2 text-right">
                  {formatCurrency(computed.totalTtc)}
                </td>
                <td className="px-2 py-2 text-right">
                  <Link
                    href={`/pc/projets/${project.id}/finance/situations/${lot.id}/${situation.id}`}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Voir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold text-slate-900">
              <td colSpan={6} className="px-2 py-3">
                Totaux opération
              </td>
              <td className="px-2 py-3 text-right">
                {formatCurrency(grandTotalPeriodHt)}
              </td>
              <td className="px-2 py-3 text-right text-blue-600">
                {formatCurrency(grandTotalPeriodTtc)}
              </td>
              <td className="px-2 py-3 text-right text-slate-400">—</td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}

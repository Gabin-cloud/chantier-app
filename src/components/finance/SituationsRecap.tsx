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
  const maxSituations = Math.max(
    0,
    ...lots.map((lot) => lot.situations?.length ?? 0)
  );

  return (
    <section className="overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-slate-900">
        Récapitulatif des situations de travaux
      </h2>
      <p className="mb-4 text-sm text-slate-500">
        {project.name} — montants en T.T.C.
      </p>

      {lots.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun lot configuré.</p>
      ) : (
        <div className="space-y-6">
          {lots.map((lot) => {
            const situations = lot.situations ?? [];
            const contractTtc = computeContractTtc(
              Number(lot.contract_amount_ht),
              Number(lot.vat_rate)
            );

            return (
              <div key={lot.id} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{lot.name}</p>
                    <p className="text-sm text-slate-500">
                      Lot {lot.lot_number} — Marché TTC {formatCurrency(contractTtc)}
                    </p>
                  </div>
                  <Link
                    href={`/pc/projets/${project.id}/finance/situations/${lot.id}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Voir les situations →
                  </Link>
                </div>

                {situations.length === 0 ? (
                  <p className="text-sm text-slate-400">Aucune situation</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500">
                        <th className="py-2 text-left font-medium">Situation</th>
                        <th className="py-2 text-left font-medium">Date</th>
                        <th className="py-2 text-right font-medium">Du mois TTC</th>
                        <th className="py-2 text-right font-medium">Cumul TTC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {situations.map((situation, index) => {
                        const previous = index > 0 ? situations[index - 1] : null;
                        const computed = computeSituation({
                          contractAmountHt: Number(lot.contract_amount_ht),
                          vatRate: Number(lot.vat_rate),
                          prorataPercent: Number(lot.prorata_percent),
                          amendments: lot.amendments ?? [],
                          situation,
                          previousSituation: previous,
                        });

                        return (
                          <tr key={situation.id} className="border-b border-slate-50">
                            <td className="py-2">n°{situation.situation_number}</td>
                            <td className="py-2">{formatDateFr(situation.situation_date)}</td>
                            <td className="py-2 text-right font-medium">
                              {formatCurrency(computed.totalPeriodTtc)}
                            </td>
                            <td className="py-2 text-right">
                              {formatCurrency(computed.totalTtc)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}

          {maxSituations > 0 && (
            <p className="text-xs text-slate-400">
              Maximum {maxSituations} situation(s) saisie(s) sur un lot.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

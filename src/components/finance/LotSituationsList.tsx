import Link from "next/link";
import {
  computeSituation,
  formatCurrency,
  formatDateFr,
} from "@/lib/finance/calculations";
import type { LotWithFinancials, Project } from "@/lib/types/database";

const SITUATIONS_BASE = (projectId: string) =>
  `/pc/projets/${projectId}/suivi-financier/situation-travaux`;

type LotSituationsListProps = {
  project: Project;
  lot: LotWithFinancials;
};

export function LotSituationsList({ project, lot }: LotSituationsListProps) {
  const situations = lot.situations ?? [];

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Situations — Lot {lot.lot_number}
          </h2>
          <p className="text-sm text-slate-500">
            {lot.designation} · {lot.name}
          </p>
        </div>
        <Link
          href={`${SITUATIONS_BASE(project.id)}/${lot.id}/nouvelle`}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          + Nouvelle situation
        </Link>
      </div>

      {situations.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune situation enregistrée.</p>
      ) : (
        <ul className="space-y-3">
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
              <li
                key={situation.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    Situation n°{situation.situation_number}
                  </p>
                  <p className="text-sm text-slate-500">
                    {formatDateFr(situation.situation_date)} · Cumul HT{" "}
                    {formatCurrency(Number(situation.works_cumulative_ht))}
                  </p>
                  <p className="text-sm text-blue-600">
                    Du mois : {formatCurrency(computed.totalPeriodTtc)} TTC
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`${SITUATIONS_BASE(project.id)}/${lot.id}/${situation.id}`}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Modifier
                  </Link>
                  <Link
                    href={`${SITUATIONS_BASE(project.id)}/${lot.id}/${situation.id}/print`}
                    className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
                  >
                    PDF
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

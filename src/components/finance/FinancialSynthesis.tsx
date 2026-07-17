import { ActionDot } from "@/components/ui/ActionDot";
import {
  AMENDMENT_SIGNATURE_STATUS_COLORS,
  AMENDMENT_SIGNATURE_STATUS_LABELS,
  AMENDMENT_SIGNATURE_STATUSES,
  computeAmendmentColumnCount,
  getAmendmentAmountTextClass,
  getAmendmentCellBackground,
  lotNeedsFinanceAction,
} from "@/lib/finance/amendment-workflow";
import {
  computeAmendmentsSplit,
  computeContractTtc,
  formatCurrency,
  formatPercent,
} from "@/lib/finance/calculations";
import type { FinancialAmendment, LotWithFinancials, Project } from "@/lib/types/database";

type FinancialSynthesisProps = {
  project: Project;
  lots: LotWithFinancials[];
};

type AmendmentCell = {
  amendment: FinancialAmendment | null;
  amount: number;
};

function buildAmendmentTooltip(amendment: FinancialAmendment): string {
  const parts = [
    amendment.amendment_type === "tma" ? "TMA" : "TS",
    AMENDMENT_SIGNATURE_STATUS_LABELS[amendment.signature_status],
  ];
  if (amendment.internal_comment?.trim()) {
    parts.push(amendment.internal_comment.trim());
  }
  return parts.join(" — ");
}

function AmendmentAmountCell({ amendment, amount }: AmendmentCell) {
  if (!amendment || amount === 0) {
    return <span className="text-slate-400">—</span>;
  }

  const bg = getAmendmentCellBackground(amendment.signature_status);
  const textClass = getAmendmentAmountTextClass(amendment.amendment_type);
  const tooltip = buildAmendmentTooltip(amendment);

  return (
    <span
      title={tooltip}
      className={`inline-block min-w-[4.5rem] rounded px-1.5 py-0.5 ${bg} ${textClass}`}
    >
      {formatCurrency(amount)}
    </span>
  );
}

function computeLotAdvancement(lot: LotWithFinancials, totalHt: number): number {
  const latest = lot.situations?.[lot.situations.length - 1];
  if (!latest || totalHt <= 0) return 0;

  const worksCum =
    Number(latest.works_cumulative_ht) +
    Number(latest.amendment_works_cumulative_ht);

  return worksCum / totalHt;
}

export function FinancialSynthesis({ project, lots }: FinancialSynthesisProps) {
  const maxAmendmentNumber = lots.reduce((max, lot) => {
    const lotMax = (lot.amendments ?? []).reduce(
      (inner, amendment) => Math.max(inner, amendment.amendment_number),
      0
    );
    return Math.max(max, lotMax);
  }, 0);

  const amendmentColumnCount = computeAmendmentColumnCount(maxAmendmentNumber);

  let totalMarketHt = 0;
  let totalTsHt = 0;
  let totalTmaHt = 0;
  let totalAmendmentsHt = 0;
  let totalMarketPlusAmendmentsHt = 0;
  let totalMarketPlusAmendmentsTtc = 0;
  let totalWorksCum = 0;
  const amendmentColumnTotals = Array.from(
    { length: amendmentColumnCount },
    () => 0
  );

  const rows = lots.map((lot) => {
    const amendments = lot.amendments ?? [];
    const { tsHt, tmaHt, totalHt: amendmentsHt } =
      computeAmendmentsSplit(amendments);
    const contractHt = Number(lot.contract_amount_ht);
    const marketPlusAmendmentsHt = contractHt + amendmentsHt;
    const marketPlusAmendmentsTtc = computeContractTtc(
      marketPlusAmendmentsHt,
      Number(lot.vat_rate)
    );
    const advancement = computeLotAdvancement(lot, marketPlusAmendmentsHt);
    const needsAction = lotNeedsFinanceAction(lot);

    const latest = lot.situations?.[lot.situations.length - 1];
    const worksCum = latest
      ? Number(latest.works_cumulative_ht) +
        Number(latest.amendment_works_cumulative_ht)
      : 0;

    totalMarketHt += contractHt;
    totalTsHt += tsHt;
    totalTmaHt += tmaHt;
    totalAmendmentsHt += amendmentsHt;
    totalMarketPlusAmendmentsHt += marketPlusAmendmentsHt;
    totalMarketPlusAmendmentsTtc += marketPlusAmendmentsTtc;
    totalWorksCum += worksCum;

    const amendmentCells: AmendmentCell[] = Array.from(
      { length: amendmentColumnCount },
      (_, index) => {
        const amendment =
          amendments.find((item) => item.amendment_number === index + 1) ?? null;
        const amount = amendment ? Number(amendment.amount_ht) : 0;
        if (amount !== 0) {
          amendmentColumnTotals[index] += amount;
        }
        return { amendment, amount };
      }
    );

    return {
      lot,
      contractHt,
      amendmentCells,
      tsHt,
      tmaHt,
      amendmentsHt,
      marketPlusAmendmentsHt,
      marketPlusAmendmentsTtc,
      advancement,
      needsAction,
    };
  });

  const totalAdvancement =
    totalMarketPlusAmendmentsHt > 0
      ? totalWorksCum / totalMarketPlusAmendmentsHt
      : 0;

  return (
    <section className="overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-slate-900">
        Synthèse financière
      </h2>
      <p className="mb-4 text-sm text-slate-500">{project.name}</p>

      <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-600">
        {AMENDMENT_SIGNATURE_STATUSES.map((status) => (
          <span
            key={status}
            className={`rounded px-2 py-1 ${AMENDMENT_SIGNATURE_STATUS_COLORS[status]}`}
          >
            {AMENDMENT_SIGNATURE_STATUS_LABELS[status]}
          </span>
        ))}
        <span className="rounded border border-slate-200 px-2 py-1">
          <span className="font-semibold text-blue-600">Bleu</span> = montant TMA
        </span>
        <span className="rounded border border-slate-200 px-2 py-1">
          Noir = montant TS
        </span>
      </div>

      {lots.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucun lot configuré. Ajoutez des lots dans Marché / Administratif ou
          l&apos;onglet Lots &amp; marchés.
        </p>
      ) : (
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-2 py-2 font-medium">N°</th>
              <th className="px-2 py-2 font-medium">Désignation des travaux</th>
              <th className="px-2 py-2 font-medium">Titulaire lot</th>
              <th className="px-2 py-2 font-medium text-right">
                Montant du marché HT
              </th>
              {Array.from({ length: amendmentColumnCount }, (_, index) => (
                <th key={index} className="px-2 py-2 font-medium text-right">
                  Avenant n°{index + 1}
                </th>
              ))}
              <th className="px-2 py-2 font-medium text-right">
                Total Avenants TS
              </th>
              <th className="px-2 py-2 font-medium text-right">
                Total Avenants TMA
              </th>
              <th className="px-2 py-2 font-medium text-right">
                Montant Avenants TS+TMA HT
              </th>
              <th className="px-2 py-2 font-medium text-right">
                Marché + avenants H.T.
              </th>
              <th className="px-2 py-2 font-medium text-right">
                Marché + avenants T.T.C.
              </th>
              <th className="px-2 py-2 font-medium text-right">
                % avancement situations
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(
              ({
                lot,
                contractHt,
                amendmentCells,
                tsHt,
                tmaHt,
                amendmentsHt,
                marketPlusAmendmentsHt,
                marketPlusAmendmentsTtc,
                advancement,
                needsAction,
              }) => (
                <tr
                  key={lot.id}
                  className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                >
                  <td className="px-2 py-2 font-medium whitespace-nowrap">
                    {lot.lot_number}
                  </td>
                  <td className="px-2 py-2">{lot.designation}</td>
                  <td className="px-2 py-2">{lot.name}</td>
                  <td className="px-2 py-2 text-right">
                    {formatCurrency(contractHt)}
                  </td>
                  {amendmentCells.map((cell, index) => (
                    <td key={index} className="px-2 py-2 text-right">
                      <AmendmentAmountCell {...cell} />
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right">
                    {tsHt !== 0 ? formatCurrency(tsHt) : "—"}
                  </td>
                  <td className="px-2 py-2 text-right text-blue-600">
                    {tmaHt !== 0 ? formatCurrency(tmaHt) : "—"}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {amendmentsHt !== 0 ? formatCurrency(amendmentsHt) : "—"}
                  </td>
                  <td className="px-2 py-2 text-right font-medium">
                    {formatCurrency(marketPlusAmendmentsHt)}
                  </td>
                  <td className="px-2 py-2 text-right font-medium">
                    {formatCurrency(marketPlusAmendmentsTtc)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatPercent(advancement)}
                    {needsAction && (
                      <ActionDot title="Une action est attendue de notre part" />
                    )}
                  </td>
                </tr>
              )
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold text-slate-900">
              <td colSpan={3} className="px-2 py-3">
                Total H.T.
              </td>
              <td className="px-2 py-3 text-right">
                {formatCurrency(totalMarketHt)}
              </td>
              {amendmentColumnTotals.map((amount, index) => (
                <td key={index} className="px-2 py-3 text-right">
                  {amount !== 0 ? formatCurrency(amount) : "—"}
                </td>
              ))}
              <td className="px-2 py-3 text-right">
                {totalTsHt !== 0 ? formatCurrency(totalTsHt) : "—"}
              </td>
              <td className="px-2 py-3 text-right text-blue-600">
                {totalTmaHt !== 0 ? formatCurrency(totalTmaHt) : "—"}
              </td>
              <td className="px-2 py-3 text-right">
                {totalAmendmentsHt !== 0
                  ? formatCurrency(totalAmendmentsHt)
                  : "—"}
              </td>
              <td className="px-2 py-3 text-right">
                {formatCurrency(totalMarketPlusAmendmentsHt)}
              </td>
              <td className="px-2 py-3 text-right">
                {formatCurrency(totalMarketPlusAmendmentsTtc)}
              </td>
              <td className="px-2 py-3 text-right tabular-nums">
                {formatPercent(totalAdvancement)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}

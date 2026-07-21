"use client";

import { PrintReportBanner } from "@/components/print/PrintReportBanner";
import { ActionDot } from "@/components/ui/ActionDot";
import type { ExcelColumn } from "@/lib/print/table-export";
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
  onAmendmentClick?: (
    amendment: FinancialAmendment,
    lot: LotWithFinancials
  ) => void;
  printRootId?: string;
  printBannerTitle?: string;
};

export function buildFinancialSynthesisExport(lots: LotWithFinancials[]): {
  columns: ExcelColumn[];
  rows: ExcelColumn[][];
} {
  const maxAmendmentNumber = lots.reduce((max, lot) => {
    const lotMax = (lot.amendments ?? []).reduce(
      (inner, amendment) => Math.max(inner, amendment.amendment_number),
      0
    );
    return Math.max(max, lotMax);
  }, 0);
  const amendmentColumnCount = computeAmendmentColumnCount(maxAmendmentNumber);

  const columns: ExcelColumn[] = [
    { header: "N°", value: "" },
    { header: "Désignation des travaux", value: "" },
    { header: "Titulaire lot", value: "" },
    { header: "Montant du marché HT", value: "" },
    ...Array.from({ length: amendmentColumnCount }, (_, index) => ({
      header: `Avenant n°${index + 1}`,
      value: "",
    })),
    { header: "Total Avenants TS", value: "" },
    { header: "Total Avenants TMA", value: "" },
    { header: "Montant Avenants TS+TMA HT", value: "" },
    { header: "Marché + avenants H.T.", value: "" },
    { header: "Marché + avenants T.T.C.", value: "" },
    { header: "% avancement situations", value: "" },
  ];

  let totalMarketHt = 0;
  let totalTsHt = 0;
  let totalTmaHt = 0;
  let totalAmendmentsHt = 0;
  let totalMarketPlusAmendmentsHt = 0;
  let totalMarketPlusAmendmentsTtc = 0;
  let totalWorksCum = 0;
  const amendmentColumnTotals = Array.from({ length: amendmentColumnCount }, () => 0);

  const rows: ExcelColumn[][] = lots.map((lot) => {
    const amendments = lot.amendments ?? [];
    const { tsHt, tmaHt, totalHt: amendmentsHt } = computeAmendmentsSplit(amendments);
    const contractHt = Number(lot.contract_amount_ht);
    const marketPlusAmendmentsHt = contractHt + amendmentsHt;
    const marketPlusAmendmentsTtc = computeContractTtc(
      marketPlusAmendmentsHt,
      Number(lot.vat_rate)
    );
    const advancement = computeLotAdvancement(lot, marketPlusAmendmentsHt);

    const latest = lot.situations?.[lot.situations.length - 1];
    const worksCum = latest
      ? Number(latest.works_cumulative_ht) + Number(latest.amendment_works_cumulative_ht)
      : 0;

    totalMarketHt += contractHt;
    totalTsHt += tsHt;
    totalTmaHt += tmaHt;
    totalAmendmentsHt += amendmentsHt;
    totalMarketPlusAmendmentsHt += marketPlusAmendmentsHt;
    totalMarketPlusAmendmentsTtc += marketPlusAmendmentsTtc;
    totalWorksCum += worksCum;

    const amendmentAmounts = Array.from({ length: amendmentColumnCount }, (_, index) => {
      const amendment = amendments.find((item) => item.amendment_number === index + 1) ?? null;
      const amount = amendment ? Number(amendment.amount_ht) : 0;
      if (amount !== 0) amendmentColumnTotals[index] += amount;
      return amount !== 0 ? formatCurrency(amount) : "—";
    });

    return [
      { header: "N°", value: lot.lot_number ?? "" },
      { header: "Désignation des travaux", value: lot.designation ?? "" },
      { header: "Titulaire lot", value: lot.name },
      { header: "Montant du marché HT", value: formatCurrency(contractHt) },
      ...amendmentAmounts.map((value, index) => ({
        header: `Avenant n°${index + 1}`,
        value,
      })),
      { header: "Total Avenants TS", value: tsHt !== 0 ? formatCurrency(tsHt) : "—" },
      { header: "Total Avenants TMA", value: tmaHt !== 0 ? formatCurrency(tmaHt) : "—" },
      {
        header: "Montant Avenants TS+TMA HT",
        value: amendmentsHt !== 0 ? formatCurrency(amendmentsHt) : "—",
      },
      { header: "Marché + avenants H.T.", value: formatCurrency(marketPlusAmendmentsHt) },
      { header: "Marché + avenants T.T.C.", value: formatCurrency(marketPlusAmendmentsTtc) },
      { header: "% avancement situations", value: formatPercent(advancement) },
    ];
  });

  const totalAdvancement =
    totalMarketPlusAmendmentsHt > 0 ? totalWorksCum / totalMarketPlusAmendmentsHt : 0;

  rows.push([
    { header: "N°", value: "Total H.T." },
    { header: "Désignation des travaux", value: "" },
    { header: "Titulaire lot", value: "" },
    { header: "Montant du marché HT", value: formatCurrency(totalMarketHt) },
    ...amendmentColumnTotals.map((amount, index) => ({
      header: `Avenant n°${index + 1}`,
      value: amount !== 0 ? formatCurrency(amount) : "—",
    })),
    { header: "Total Avenants TS", value: totalTsHt !== 0 ? formatCurrency(totalTsHt) : "—" },
    { header: "Total Avenants TMA", value: totalTmaHt !== 0 ? formatCurrency(totalTmaHt) : "—" },
    {
      header: "Montant Avenants TS+TMA HT",
      value: totalAmendmentsHt !== 0 ? formatCurrency(totalAmendmentsHt) : "—",
    },
    { header: "Marché + avenants H.T.", value: formatCurrency(totalMarketPlusAmendmentsHt) },
    { header: "Marché + avenants T.T.C.", value: formatCurrency(totalMarketPlusAmendmentsTtc) },
    { header: "% avancement situations", value: formatPercent(totalAdvancement) },
  ]);

  return { columns, rows };
}

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

function AmendmentAmountCell({
  amendment,
  amount,
  lot,
  onAmendmentClick,
}: AmendmentCell & {
  lot: LotWithFinancials;
  onAmendmentClick?: (
    amendment: FinancialAmendment,
    lot: LotWithFinancials
  ) => void;
}) {
  if (!amendment || amount === 0) {
    return <span className="text-slate-400">—</span>;
  }

  const bg = getAmendmentCellBackground(amendment.signature_status);
  const textClass = getAmendmentAmountTextClass(amendment.amendment_type);
  const tooltip = buildAmendmentTooltip(amendment);
  const clickable = Boolean(onAmendmentClick);

  const content = (
    <span
      title={tooltip}
      className={`inline-block min-w-[4.5rem] rounded px-1.5 py-0.5 ${bg} ${textClass} ${
        clickable ? "cursor-pointer hover:ring-2 hover:ring-violet-300" : ""
      }`}
    >
      {formatCurrency(amount)}
    </span>
  );

  if (!clickable || !onAmendmentClick) {
    return content;
  }

  return (
    <button
      type="button"
      onClick={() => onAmendmentClick(amendment, lot)}
      className="inline-block text-left"
      title={`${tooltip} — Cliquer pour ouvrir l'avenant`}
    >
      {content}
    </button>
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

function SynthesisTableBody({
  lots,
  amendmentColumnCount,
  amendmentColumnTotals,
  rows,
  onAmendmentClick,
  compact,
}: {
  lots: LotWithFinancials[];
  amendmentColumnCount: number;
  amendmentColumnTotals: number[];
  rows: ReturnType<typeof buildFinancialSynthesisRows>["rows"];
  onAmendmentClick?: (
    amendment: FinancialAmendment,
    lot: LotWithFinancials
  ) => void;
  compact?: boolean;
}) {
  const cellClass = compact ? "px-1 py-1 text-xs" : "px-2 py-2";
  const totalMarketHt = rows.reduce((sum, row) => sum + row.contractHt, 0);
  const totalTsHt = rows.reduce((sum, row) => sum + row.tsHt, 0);
  const totalTmaHt = rows.reduce((sum, row) => sum + row.tmaHt, 0);
  const totalAmendmentsHt = rows.reduce((sum, row) => sum + row.amendmentsHt, 0);
  const totalMarketPlusAmendmentsHt = rows.reduce(
    (sum, row) => sum + row.marketPlusAmendmentsHt,
    0
  );
  const totalMarketPlusAmendmentsTtc = rows.reduce(
    (sum, row) => sum + row.marketPlusAmendmentsTtc,
    0
  );
  const totalWorksCum = rows.reduce((sum, row) => {
    const latest = row.lot.situations?.[row.lot.situations.length - 1];
    return (
      sum +
      (latest
        ? Number(latest.works_cumulative_ht) + Number(latest.amendment_works_cumulative_ht)
        : 0)
    );
  }, 0);
  const totalAdvancement =
    totalMarketPlusAmendmentsHt > 0 ? totalWorksCum / totalMarketPlusAmendmentsHt : 0;

  if (lots.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun lot configuré. Ajoutez des lots dans Marché / Administratif ou l&apos;onglet Lots
        &amp; marchés.
      </p>
    );
  }

  return (
    <table className={`w-full min-w-[1100px] text-left ${compact ? "text-xs" : "text-sm"}`}>
      <thead>
        <tr className="border-b border-slate-200 text-slate-500">
          <th className={`${cellClass} font-medium`}>N°</th>
          <th className={`${cellClass} font-medium`}>Désignation des travaux</th>
          <th className={`${cellClass} font-medium`}>Titulaire lot</th>
          <th className={`${cellClass} font-medium text-right`}>Montant du marché HT</th>
          {Array.from({ length: amendmentColumnCount }, (_, index) => (
            <th key={index} className={`${cellClass} font-medium text-right`}>
              Avenant n°{index + 1}
            </th>
          ))}
          <th className={`${cellClass} font-medium text-right`}>Total Avenants TS</th>
          <th className={`${cellClass} font-medium text-right`}>Total Avenants TMA</th>
          <th className={`${cellClass} font-medium text-right`}>Montant Avenants TS+TMA HT</th>
          <th className={`${cellClass} font-medium text-right`}>Marché + avenants H.T.</th>
          <th className={`${cellClass} font-medium text-right`}>Marché + avenants T.T.C.</th>
          <th className={`${cellClass} font-medium text-right`}>% avancement situations</th>
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
              <td className={`${cellClass} font-medium whitespace-nowrap`}>{lot.lot_number}</td>
              <td className={cellClass}>{lot.designation}</td>
              <td className={cellClass}>{lot.name}</td>
              <td className={`${cellClass} text-right`}>{formatCurrency(contractHt)}</td>
              {amendmentCells.map((cell, index) => (
                <td key={index} className={`${cellClass} text-right`}>
                  {compact || !onAmendmentClick ? (
                    cell.amount !== 0 ? (
                      formatCurrency(cell.amount)
                    ) : (
                      <span className="text-slate-400">—</span>
                    )
                  ) : (
                    <AmendmentAmountCell
                      {...cell}
                      lot={lot}
                      onAmendmentClick={onAmendmentClick}
                    />
                  )}
                </td>
              ))}
              <td className={`${cellClass} text-right`}>
                {tsHt !== 0 ? formatCurrency(tsHt) : "—"}
              </td>
              <td className={`${cellClass} text-right text-blue-600`}>
                {tmaHt !== 0 ? formatCurrency(tmaHt) : "—"}
              </td>
              <td className={`${cellClass} text-right`}>
                {amendmentsHt !== 0 ? formatCurrency(amendmentsHt) : "—"}
              </td>
              <td className={`${cellClass} text-right font-medium`}>
                {formatCurrency(marketPlusAmendmentsHt)}
              </td>
              <td className={`${cellClass} text-right font-medium`}>
                {formatCurrency(marketPlusAmendmentsTtc)}
              </td>
              <td className={`${cellClass} text-right tabular-nums`}>
                {formatPercent(advancement)}
                {!compact && needsAction && (
                  <ActionDot title="Une action est attendue de notre part" />
                )}
              </td>
            </tr>
          )
        )}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-slate-300 font-semibold text-slate-900">
          <td colSpan={3} className={`${cellClass} py-3`}>
            Total H.T.
          </td>
          <td className={`${cellClass} py-3 text-right`}>{formatCurrency(totalMarketHt)}</td>
          {amendmentColumnTotals.map((amount, index) => (
            <td key={index} className={`${cellClass} py-3 text-right`}>
              {amount !== 0 ? formatCurrency(amount) : "—"}
            </td>
          ))}
          <td className={`${cellClass} py-3 text-right`}>
            {totalTsHt !== 0 ? formatCurrency(totalTsHt) : "—"}
          </td>
          <td className={`${cellClass} py-3 text-right text-blue-600`}>
            {totalTmaHt !== 0 ? formatCurrency(totalTmaHt) : "—"}
          </td>
          <td className={`${cellClass} py-3 text-right`}>
            {totalAmendmentsHt !== 0 ? formatCurrency(totalAmendmentsHt) : "—"}
          </td>
          <td className={`${cellClass} py-3 text-right`}>
            {formatCurrency(totalMarketPlusAmendmentsHt)}
          </td>
          <td className={`${cellClass} py-3 text-right`}>
            {formatCurrency(totalMarketPlusAmendmentsTtc)}
          </td>
          <td className={`${cellClass} py-3 text-right tabular-nums`}>
            {formatPercent(totalAdvancement)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

function buildFinancialSynthesisRows(lots: LotWithFinancials[]) {
  const maxAmendmentNumber = lots.reduce((max, lot) => {
    const lotMax = (lot.amendments ?? []).reduce(
      (inner, amendment) => Math.max(inner, amendment.amendment_number),
      0
    );
    return Math.max(max, lotMax);
  }, 0);

  const amendmentColumnCount = computeAmendmentColumnCount(maxAmendmentNumber);
  const amendmentColumnTotals = Array.from({ length: amendmentColumnCount }, () => 0);

  const rows = lots.map((lot) => {
    const amendments = lot.amendments ?? [];
    const { tsHt, tmaHt, totalHt: amendmentsHt } = computeAmendmentsSplit(amendments);
    const contractHt = Number(lot.contract_amount_ht);
    const marketPlusAmendmentsHt = contractHt + amendmentsHt;
    const marketPlusAmendmentsTtc = computeContractTtc(
      marketPlusAmendmentsHt,
      Number(lot.vat_rate)
    );
    const advancement = computeLotAdvancement(lot, marketPlusAmendmentsHt);
    const needsAction = lotNeedsFinanceAction(lot);

    const amendmentCells: AmendmentCell[] = Array.from(
      { length: amendmentColumnCount },
      (_, index) => {
        const amendment =
          amendments.find((item) => item.amendment_number === index + 1) ?? null;
        const amount = amendment ? Number(amendment.amount_ht) : 0;
        if (amount !== 0) amendmentColumnTotals[index] += amount;
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

  return { amendmentColumnCount, amendmentColumnTotals, rows };
}

export function FinancialSynthesis({
  project,
  lots,
  onAmendmentClick,
  printRootId,
  printBannerTitle,
}: FinancialSynthesisProps) {
  const { amendmentColumnCount, amendmentColumnTotals, rows } =
    buildFinancialSynthesisRows(lots);

  return (
    <section className="relative overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
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

      <SynthesisTableBody
        lots={lots}
        amendmentColumnCount={amendmentColumnCount}
        amendmentColumnTotals={amendmentColumnTotals}
        rows={rows}
        onAmendmentClick={onAmendmentClick}
      />

      {printRootId && printBannerTitle ? (
        <div
          id={printRootId}
          aria-hidden
          className="pointer-events-none absolute top-0 -left-[10000px] w-[297mm] bg-white p-4"
        >
          <PrintReportBanner title={printBannerTitle} project={project} />
          <SynthesisTableBody
            lots={lots}
            amendmentColumnCount={amendmentColumnCount}
            amendmentColumnTotals={amendmentColumnTotals}
            rows={rows}
            compact
          />
        </div>
      ) : null}
    </section>
  );
}

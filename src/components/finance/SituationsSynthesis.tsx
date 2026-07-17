import {
  buildSituationsSynthesis,
  type LotSituationsSynthesis,
  type SituationColumnData,
} from "@/lib/finance/situations-synthesis";
import { formatCurrency, formatPercent } from "@/lib/finance/calculations";
import type { LotWithFinancials, Project } from "@/lib/types/database";

type SituationsSynthesisProps = {
  project: Project;
  lots: LotWithFinancials[];
};

const BORDER = "border border-[#B4C6E7]";
const CELL = `${BORDER} px-1.5 py-0.5 text-[10px] leading-tight align-middle`;
const AMOUNT = "tabular-nums text-right whitespace-nowrap";
const LABEL = "text-[9px] italic text-slate-500";

function formatProrataPercent(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "—";
  return formatCurrency(value);
}

const SITUATION_ROW_LABELS = [
  "situation du mois à payer",
  "situation cumulée",
  "date de la situation",
  "Prorata retenue cumulée",
] as const;

function SituationLine({
  label,
  children,
  bold,
}: {
  label: string;
  children: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-1 border-b border-[#D9E2F3] px-1 py-[3px] last:border-b-0 ${bold ? "font-bold" : ""}`}
    >
      <span className={`${LABEL} shrink-0`}>{label}</span>
      <span className={`${AMOUNT} min-w-0 text-slate-800`}>{children}</span>
    </div>
  );
}

function SituationBox({
  column,
  isBufferColumn,
}: {
  column: SituationColumnData;
  isBufferColumn: boolean;
}) {
  const empty = !column.situation || isBufferColumn;

  return (
    <div className="flex min-h-[6.25rem] flex-col justify-between bg-white py-0.5">
      {empty ? (
        SITUATION_ROW_LABELS.map((label) => (
          <SituationLine key={label} label={label}>
            <span className="text-slate-300">—</span>
          </SituationLine>
        ))
      ) : (
        <>
          <SituationLine label={SITUATION_ROW_LABELS[0]} bold>
            <span className="inline-flex items-baseline gap-1">
              {formatAmount(column.periodTtc)}
              {column.advancementPercent !== null && (
                <span className="text-[9px] font-normal text-slate-500">
                  {formatPercent(column.advancementPercent)}
                </span>
              )}
            </span>
          </SituationLine>
          <SituationLine label={SITUATION_ROW_LABELS[1]}>
            {formatAmount(column.cumulativeTtc)}
          </SituationLine>
          <SituationLine label={SITUATION_ROW_LABELS[2]}>
            <span className="text-[9px]">{column.dateLabel ?? "—"}</span>
          </SituationLine>
          <SituationLine label={SITUATION_ROW_LABELS[3]}>
            {formatAmount(column.prorataCumulativeHt)}
          </SituationLine>
        </>
      )}
    </div>
  );
}

function LotSituationsBlock({
  block,
  columnCount,
}: {
  block: LotSituationsSynthesis;
  columnCount: number;
}) {
  const { lot, columns, subcontractors } = block;
  const recapRowCount = 4 + subcontractors.length;
  const paymentRowCount = subcontractors.length * 2;
  const totalRowSpan = recapRowCount + paymentRowCount;

  const recapRows: {
    label: string;
    amount: string;
    highlight?: boolean;
    bold?: boolean;
    alt?: boolean;
  }[] = [
    {
      label: "marché de base T.T.C.",
      amount: formatAmount(block.contractBaseTtc),
    },
    {
      label: "avenant au marché",
      amount: formatAmount(block.amendmentsTtc),
      alt: true,
    },
    ...subcontractors.map((sub) => ({
      label: sub.name,
      amount: formatAmount(sub.delegationAmount),
      highlight: true,
    })),
    {
      label: "total du marché T.T.C.",
      amount: formatAmount(block.totalMarketTtc),
      bold: true,
    },
    {
      label: "Prorata",
      amount:
        block.prorataAmountTtc !== 0
          ? `${formatProrataPercent(block.prorataPercent)} ${formatCurrency(block.prorataAmountTtc)}`
          : formatProrataPercent(block.prorataPercent),
      alt: true,
    },
  ];

  return (
    <tbody className="border-b-2 border-[#2F5496]">
      {recapRows.map((row, rowIndex) => (
        <tr
          key={row.label}
          className={
            row.highlight
              ? "bg-amber-50/50 hover:bg-amber-50/70"
              : row.alt
                ? "bg-slate-50/40 hover:bg-slate-50/50"
                : "hover:bg-slate-50/50"
          }
        >
          {rowIndex === 0 ? (
            <td
              rowSpan={totalRowSpan}
              className="w-[9rem] border border-[#2F5496] bg-[#4472C4] px-2 py-3 text-center align-middle font-bold text-white"
            >
              <div className="text-[11px] uppercase leading-tight">{lot.name}</div>
              {lot.designation ? (
                <div className="mt-1 text-[9px] font-normal normal-case opacity-90">
                  {lot.designation}
                </div>
              ) : null}
            </td>
          ) : null}

          <td className={`${CELL} text-slate-700 ${row.bold ? "font-bold" : ""}`}>
            {row.label}
          </td>
          <td className={`${CELL} ${AMOUNT} ${row.bold ? "font-bold" : "font-medium"}`}>
            {row.amount}
          </td>

          {rowIndex === 0
            ? columns.map((column, colIndex) => (
                <td
                  key={column.number}
                  rowSpan={recapRowCount}
                  className={`${CELL} min-w-[7.5rem] w-[7.5rem] p-0 align-top`}
                >
                  <SituationBox
                    column={column}
                    isBufferColumn={colIndex === columnCount - 1}
                  />
                </td>
              ))
            : null}
        </tr>
      ))}

      {subcontractors.flatMap((subcontractor) => [
        <tr
          key={`${subcontractor.name}-period`}
          className="bg-amber-50/30 hover:bg-amber-50/50"
        >
          <td colSpan={2} className={`${CELL} pl-3 text-slate-600`}>
            {subcontractor.name} — du mois
          </td>
          {columns.map((column, colIndex) => (
            <td key={column.number} className={`${CELL} ${AMOUNT}`}>
              {colIndex === columnCount - 1
                ? "—"
                : formatAmount(
                    column.subcontractorPayments.find(
                      (item) => item.name === subcontractor.name
                    )?.periodTtc ?? null
                  )}
            </td>
          ))}
        </tr>,
        <tr
          key={`${subcontractor.name}-cumul`}
          className="bg-amber-50/30 hover:bg-amber-50/50"
        >
          <td colSpan={2} className={`${CELL} pl-3 text-slate-600`}>
            {subcontractor.name} — cumul
          </td>
          {columns.map((column, colIndex) => (
            <td key={column.number} className={`${CELL} ${AMOUNT}`}>
              {colIndex === columnCount - 1
                ? "—"
                : formatAmount(
                    column.subcontractorPayments.find(
                      (item) => item.name === subcontractor.name
                    )?.cumulativeTtc ?? null
                  )}
            </td>
          ))}
        </tr>,
      ])}
    </tbody>
  );
}

export function SituationsSynthesis({ project, lots }: SituationsSynthesisProps) {
  const { columnCount, blocks } = buildSituationsSynthesis(lots);

  return (
    <section className="space-y-2">
      <div className="border-2 border-[#2F5496] bg-[#2F5496] px-3 py-2 text-center text-white">
        <h2 className="text-xs font-bold uppercase tracking-wide">
          Récapitulatif des situations de travaux des entreprises
        </h2>
        <p className="text-[10px] opacity-90">{project.name}</p>
      </div>

      <p className="text-[11px] font-semibold text-slate-700">en EUROS T.T.C.</p>

      {lots.length === 0 ? (
        <p className="border border-slate-300 bg-white p-4 text-sm text-slate-500">
          Aucun lot configuré.
        </p>
      ) : (
        <div className="overflow-x-auto border-2 border-[#2F5496] bg-white">
          <table className="w-full min-w-[1200px] border-collapse">
            <thead>
              <tr className="bg-[#2F5496] text-[10px] font-bold text-white">
                <th className={`${CELL} w-[9rem] border-[#B4C6E7] text-center`}>
                  Entreprise
                </th>
                <th className={`${CELL} border-[#B4C6E7] text-left`}>Libellé</th>
                <th className={`${CELL} w-[8rem] border-[#B4C6E7] text-right`}>
                  Montant
                </th>
                {Array.from({ length: columnCount }, (_, index) => (
                  <th
                    key={index}
                    className={`${CELL} min-w-[7.5rem] border-[#B4C6E7] text-center`}
                  >
                    situation n°{String(index + 1).padStart(2, "0")}
                  </th>
                ))}
              </tr>
            </thead>

            {blocks.map((block) => (
              <LotSituationsBlock
                key={block.lot.id}
                block={block}
                columnCount={columnCount}
              />
            ))}
          </table>
        </div>
      )}
    </section>
  );
}

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

const cell =
  "border border-slate-300 px-2 py-0.5 text-[11px] leading-snug align-middle";
const amountClass = "tabular-nums text-right whitespace-nowrap";

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

function RecapStack({ block }: { block: LotSituationsSynthesis }) {
  const { subcontractors } = block;

  return (
    <div className="flex flex-col gap-1 py-1">
      <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 pb-1">
        <span className="text-slate-700">marché de base T.T.C.</span>
        <span className={`${amountClass} font-medium`}>
          {formatAmount(block.contractBaseTtc)}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 pb-1">
        <span className="text-slate-700">avenant au marché</span>
        <span className={amountClass}>{formatAmount(block.amendmentsTtc)}</span>
      </div>
      {subcontractors.map((subcontractor) => (
        <div
          key={subcontractor.name}
          className="flex items-baseline justify-between gap-3 border-b border-amber-200 bg-amber-50/60 px-1 pb-1"
        >
          <span className="font-medium text-slate-800">{subcontractor.name}</span>
          <span className={amountClass}>
            {formatAmount(subcontractor.delegationAmount)}
          </span>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 pb-1 font-bold">
        <span>total du marché T.T.C.</span>
        <span className={amountClass}>{formatAmount(block.totalMarketTtc)}</span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-slate-700">Prorata</span>
        <span className={amountClass}>
          {formatProrataPercent(block.prorataPercent)}
          {block.prorataAmountTtc !== 0 && (
            <span className="ml-1 font-normal text-slate-600">
              {formatCurrency(block.prorataAmountTtc)}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function SituationLabels() {
  const labels = [
    "situation du mois à payer",
    "situation cumulée",
    "date de la situation",
    "Prorata retenue cumulée",
  ];

  return (
    <div className="flex h-full min-h-[5.5rem] flex-col justify-between py-1 italic text-slate-600">
      {labels.map((label) => (
        <div key={label} className="px-1">
          {label}
        </div>
      ))}
    </div>
  );
}

function SituationBox({ column }: { column: SituationColumnData }) {
  if (!column.situation) {
    return (
      <td className={`${cell} min-w-[6.5rem] border-2 border-slate-700 p-0 align-top`}>
        <div className="flex min-h-[5.5rem] items-center justify-center text-slate-300">
          —
        </div>
      </td>
    );
  }

  return (
    <td className={`${cell} min-w-[6.5rem] border-2 border-slate-700 p-0 align-top`}>
      <div className="flex min-h-[5.5rem] flex-col justify-between divide-y divide-slate-400 py-0.5">
        <div className={`px-1.5 py-0.5 ${amountClass} font-bold text-slate-900`}>
          <div className="flex items-baseline justify-end gap-1">
            <span>{formatAmount(column.periodTtc)}</span>
            {column.advancementPercent !== null && (
              <span className="text-[10px] font-normal text-slate-500">
                {formatPercent(column.advancementPercent)}
              </span>
            )}
          </div>
        </div>
        <div className={`px-1.5 py-0.5 ${amountClass} text-slate-800`}>
          {formatAmount(column.cumulativeTtc)}
        </div>
        <div className="px-1.5 py-0.5 text-center text-[10px] text-slate-700">
          {column.dateLabel}
        </div>
        <div className={`px-1.5 py-0.5 ${amountClass} text-slate-600`}>
          {formatAmount(column.prorataCumulativeHt)}
        </div>
      </div>
    </td>
  );
}

function LotSituationsBlock({ block }: { block: LotSituationsSynthesis }) {
  const { lot, columns, subcontractors } = block;
  const paymentRowCount = subcontractors.length * 2;
  const totalRowSpan = 1 + paymentRowCount;

  return (
    <tbody className="border-b-[3px] border-slate-400">
      <tr className="hover:bg-slate-50/60">
        <td
          rowSpan={totalRowSpan}
          className="w-[8.5rem] border border-slate-300 bg-[#4472C4] px-2 py-2 text-center align-middle font-bold text-white"
        >
          <div className="text-[11px] uppercase leading-tight">{lot.name}</div>
          <div className="mt-1 text-[10px] font-normal opacity-90">
            {lot.designation}
          </div>
        </td>
        <td
          rowSpan={totalRowSpan}
          colSpan={2}
          className="w-[14rem] border border-slate-300 align-top"
        >
          <RecapStack block={block} />
        </td>
        <td className="w-[9.5rem] border border-slate-300 align-top">
          <SituationLabels />
        </td>
        {columns.map((column) => (
          <SituationBox key={column.number} column={column} />
        ))}
      </tr>

      {subcontractors.flatMap((subcontractor) => [
        <tr key={`${subcontractor.name}-period`} className="hover:bg-amber-50/40">
          <td className={`${cell} pl-3 text-slate-600`}>
            {subcontractor.name} — du mois
          </td>
          {columns.map((column) => {
            const payment = column.subcontractorPayments.find(
              (item) => item.name === subcontractor.name
            );
            return (
              <td key={column.number} className={`${cell} ${amountClass}`}>
                {formatAmount(payment?.periodTtc ?? null)}
              </td>
            );
          })}
        </tr>,
        <tr key={`${subcontractor.name}-cumul`} className="hover:bg-amber-50/40">
          <td className={`${cell} pl-3 text-slate-600`}>
            {subcontractor.name} — cumul
          </td>
          {columns.map((column) => {
            const payment = column.subcontractorPayments.find(
              (item) => item.name === subcontractor.name
            );
            return (
              <td key={column.number} className={`${cell} ${amountClass}`}>
                {formatAmount(payment?.cumulativeTtc ?? null)}
              </td>
            );
          })}
        </tr>,
      ])}
    </tbody>
  );
}

export function SituationsSynthesis({ project, lots }: SituationsSynthesisProps) {
  const { columnCount, blocks } = buildSituationsSynthesis(lots);

  return (
    <section className="space-y-2">
      <div className="border-2 border-slate-700 bg-[#2F5496] px-3 py-2 text-center text-white">
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
        <div className="overflow-x-auto border border-slate-400 bg-white">
          <table className="w-full min-w-[880px] border-collapse">
            <thead>
              <tr className="bg-[#2F5496] text-[11px] font-bold text-white">
                <th className={`${cell} w-[8.5rem] border-slate-500 text-left`}>
                  Entreprise
                </th>
                <th
                  colSpan={2}
                  className={`${cell} border-slate-500 text-left`}
                >
                  Récapitulatif marché
                </th>
                <th className={`${cell} w-[9.5rem] border-slate-500`} />
                {Array.from({ length: columnCount }, (_, index) => (
                  <th
                    key={index}
                    className={`${cell} min-w-[6.5rem] border-slate-500 text-center`}
                  >
                    situation n°{String(index + 1).padStart(2, "0")}
                  </th>
                ))}
              </tr>
            </thead>

            {blocks.map((block) => (
              <LotSituationsBlock key={block.lot.id} block={block} />
            ))}
          </table>
        </div>
      )}
    </section>
  );
}

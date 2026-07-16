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

function formatProrataPercent(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function AmountCell({ value }: { value: number | null }) {
  if (value === null || value === 0) {
    return <span className="text-slate-400">—</span>;
  }
  return <span className="tabular-nums">{formatCurrency(value)}</span>;
}

function SituationColumns({
  columns,
  render,
}: {
  columns: SituationColumnData[];
  render: (column: SituationColumnData) => React.ReactNode;
}) {
  return (
    <>
      {columns.map((column) => (
        <td
          key={column.number}
          className="border-l border-slate-100 px-2 py-1.5 text-right align-top"
        >
          {render(column)}
        </td>
      ))}
    </>
  );
}

function LotSituationsBlock({ block }: { block: LotSituationsSynthesis }) {
  const { lot, columns, subcontractors } = block;
  const hasSubcontractors = subcontractors.length > 0;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-sky-700 text-white">
            <th
              colSpan={2}
              className="sticky left-0 z-10 bg-sky-700 px-3 py-2 text-left font-semibold"
            >
              {lot.lot_number} — {lot.designation}
            </th>
            <th
              colSpan={1}
              className="px-3 py-2 text-left font-medium text-sky-100"
            >
              {lot.name}
            </th>
            {columns.map((column) => (
              <th
                key={column.number}
                className="min-w-[7.5rem] border-l border-sky-600 px-2 py-2 text-center font-semibold"
              >
                Situation n°{String(column.number).padStart(2, "0")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100 hover:bg-slate-50">
            <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium text-slate-700">
              Marché de base T.T.C.
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums">
              {formatCurrency(block.contractBaseTtc)}
            </td>
            <td className="px-3 py-1.5 text-slate-400" />
            <SituationColumns columns={columns} render={() => null} />
          </tr>

          <tr className="border-b border-slate-100 hover:bg-slate-50">
            <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium text-slate-700">
              Avenant au marché
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums">
              {block.amendmentsTtc !== 0
                ? formatCurrency(block.amendmentsTtc)
                : "—"}
            </td>
            <td className="px-3 py-1.5 text-slate-400" />
            <SituationColumns columns={columns} render={() => null} />
          </tr>

          {subcontractors.map((subcontractor) => (
            <tr
              key={subcontractor.name}
              className="border-b border-slate-100 bg-amber-50/40 hover:bg-slate-50"
            >
              <td className="sticky left-0 z-10 bg-amber-50/40 px-3 py-1.5 font-medium text-slate-700">
                Sous-traitant — {subcontractor.name}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {formatCurrency(subcontractor.delegationAmount)}
              </td>
              <td className="px-3 py-1.5 text-xs text-slate-500">
                Montant délégation
              </td>
              <SituationColumns columns={columns} render={() => null} />
            </tr>
          ))}

          <tr className="border-b border-slate-200 bg-slate-50 hover:bg-slate-100">
            <td className="sticky left-0 z-10 bg-slate-50 px-3 py-1.5 font-semibold text-slate-900">
              Total du marché T.T.C.
            </td>
            <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
              {formatCurrency(block.totalMarketTtc)}
            </td>
            <td className="px-3 py-1.5" />
            <SituationColumns columns={columns} render={() => null} />
          </tr>

          <tr className="border-b border-slate-200 hover:bg-slate-50">
            <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium text-slate-700">
              Prorata
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums">
              {formatProrataPercent(block.prorataPercent)}
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">
              {block.prorataAmountTtc !== 0
                ? formatCurrency(block.prorataAmountTtc)
                : "—"}
            </td>
            <SituationColumns columns={columns} render={() => null} />
          </tr>

          <tr className="border-b border-slate-100 hover:bg-slate-50">
            <td className="sticky left-0 z-10 bg-white px-3 py-1.5 text-slate-500" />
            <td className="px-3 py-1.5 font-medium text-slate-700">
              Situation du mois à payer
            </td>
            <td className="px-3 py-1.5" />
            <SituationColumns
              columns={columns}
              render={(column) => (
                <AmountCell value={column.periodTtc} />
              )}
            />
          </tr>

          <tr className="border-b border-slate-100 hover:bg-slate-50">
            <td className="sticky left-0 z-10 bg-white px-3 py-1.5 text-slate-500" />
            <td className="px-3 py-1.5 font-medium text-slate-700">
              Situation cumulée
            </td>
            <td className="px-3 py-1.5" />
            <SituationColumns
              columns={columns}
              render={(column) => (
                <div>
                  <AmountCell value={column.cumulativeTtc} />
                  {column.advancementPercent !== null && column.situation && (
                    <div className="mt-0.5 text-xs text-slate-500">
                      {formatPercent(column.advancementPercent)}
                    </div>
                  )}
                </div>
              )}
            />
          </tr>

          <tr className="border-b border-slate-100 hover:bg-slate-50">
            <td className="sticky left-0 z-10 bg-white px-3 py-1.5 text-slate-500" />
            <td className="px-3 py-1.5 font-medium text-slate-700">
              Date de la situation
            </td>
            <td className="px-3 py-1.5" />
            <SituationColumns
              columns={columns}
              render={(column) =>
                column.dateLabel ? (
                  <span className="text-slate-700">{column.dateLabel}</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )
              }
            />
          </tr>

          <tr className="border-b border-slate-100 hover:bg-slate-50">
            <td className="sticky left-0 z-10 bg-white px-3 py-1.5 text-slate-500" />
            <td className="px-3 py-1.5 font-medium text-slate-700">
              Prorata retenue cumulée
            </td>
            <td className="px-3 py-1.5" />
            <SituationColumns
              columns={columns}
              render={(column) => (
                <AmountCell value={column.prorataCumulativeHt} />
              )}
            />
          </tr>

          {hasSubcontractors &&
            subcontractors.flatMap((subcontractor) => [
              <tr
                key={`${subcontractor.name}-period`}
                className="border-b border-slate-100 bg-amber-50/30 hover:bg-slate-50"
              >
                <td className="sticky left-0 z-10 bg-amber-50/30 px-3 py-1.5 text-slate-500" />
                <td className="px-3 py-1.5 font-medium text-slate-700">
                  {subcontractor.name} — du mois
                </td>
                <td className="px-3 py-1.5 text-xs text-slate-500">
                  Délégation
                </td>
                <SituationColumns
                  columns={columns}
                  render={(column) => {
                    const payment = column.subcontractorPayments.find(
                      (item) => item.name === subcontractor.name
                    );
                    return (
                      <AmountCell value={payment?.periodTtc ?? null} />
                    );
                  }}
                />
              </tr>,
              <tr
                key={`${subcontractor.name}-cumul`}
                className="border-b border-slate-200 bg-amber-50/30 hover:bg-slate-50"
              >
                <td className="sticky left-0 z-10 bg-amber-50/30 px-3 py-1.5 text-slate-500" />
                <td className="px-3 py-1.5 font-medium text-slate-700">
                  {subcontractor.name} — cumul
                </td>
                <td className="px-3 py-1.5 text-xs text-slate-500">
                  Délégation
                </td>
                <SituationColumns
                  columns={columns}
                  render={(column) => {
                    const payment = column.subcontractorPayments.find(
                      (item) => item.name === subcontractor.name
                    );
                    return (
                      <AmountCell value={payment?.cumulativeTtc ?? null} />
                    );
                  }}
                />
              </tr>,
            ])}
        </tbody>
      </table>
    </div>
  );
}

export function SituationsSynthesis({ project, lots }: SituationsSynthesisProps) {
  const { blocks } = buildSituationsSynthesis(lots);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Synthèse des situations de travaux
        </h2>
        <p className="text-sm text-slate-500">{project.name}</p>
      </div>

      {lots.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">
          Aucun lot configuré.
        </p>
      ) : (
        <div className="space-y-6">
          {blocks.map((block) => (
            <LotSituationsBlock key={block.lot.id} block={block} />
          ))}
        </div>
      )}
    </section>
  );
}

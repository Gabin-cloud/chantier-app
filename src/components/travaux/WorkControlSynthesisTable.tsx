"use client";

import Link from "next/link";
import { SlantedColumnHeader } from "@/components/marche/SlantedColumnHeader";
import type { WorkControlSynthesisData } from "@/lib/types/work-control";

type WorkControlSynthesisTableProps = {
  projectId: string;
  data: WorkControlSynthesisData;
};

const th =
  "border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600";
const td = "border border-slate-200 px-1.5 py-1 text-xs text-slate-700";

function SynthesisCell({
  conformCount,
  nonConformCount,
  conformityRatio,
}: {
  conformCount: number;
  nonConformCount: number;
  conformityRatio: number | null;
}) {
  if (conformCount === 0 && nonConformCount === 0) {
    return <span className="text-slate-300">—</span>;
  }

  return (
    <div className="flex min-h-[2.75rem] flex-col justify-between gap-0.5 p-0.5">
      <div className="flex justify-between gap-1 text-[10px] font-semibold leading-none">
        <span className="text-emerald-700" title="Conformités">
          {conformCount}
        </span>
        <span className="text-red-600" title="Non-conformités">
          {nonConformCount}
        </span>
      </div>
      <div className="border-t border-slate-200 pt-0.5 text-center text-[10px] font-medium tabular-nums text-slate-600">
        {conformityRatio !== null ? `${conformityRatio} %` : "—"}
      </div>
    </div>
  );
}

export function WorkControlSynthesisTable({
  projectId,
  data,
}: WorkControlSynthesisTableProps) {
  const { phases, rows, projectTotal } = data;

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-900">
          Synthèse des contrôles par lot et par phase
        </h2>
        <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
          <span>
            <span className="font-semibold text-emerald-700">Gauche</span> : conformités
          </span>
          <span>
            <span className="font-semibold text-red-600">Droite</span> : non-conformités
          </span>
          <span>Bas : taux de conformité</span>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="px-3 py-6 text-sm text-slate-500">
          Aucun lot configuré. Ajoutez des entreprises dans la fiche opération.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                <th className={`${th} bg-slate-100`} colSpan={3}>
                  Entreprise
                </th>
                <th
                  className={`${th} bg-emerald-50`}
                  colSpan={phases.length + 1}
                >
                  Contrôles par phase
                </th>
              </tr>
              <tr className="bg-slate-50">
                <th className={`${th} w-[3rem] text-center`}>N° lot</th>
                <th className={`${th} min-w-[5rem]`}>Lot</th>
                <th className={`${th} min-w-[7rem]`}>Entreprise</th>
                <SlantedColumnHeader label="Total" angle={70} />
                {phases.map((phase) => (
                  <SlantedColumnHeader
                    key={phase.id}
                    label={phase.name}
                    title={phase.name}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.enterprise.id} className="hover:bg-slate-50/60">
                  <td className={`${td} text-center font-medium`}>
                    {row.enterprise.lot_number ?? "—"}
                  </td>
                  <td className={td}>{row.enterprise.designation ?? "—"}</td>
                  <td className={`${td} font-medium text-slate-900`}>
                    <Link
                      href={`/pc/projets/${projectId}/suivi-travaux/controle?enterprise=${row.enterprise.id}`}
                      className="text-slate-900 hover:underline"
                    >
                      {row.enterprise.name}
                    </Link>
                  </td>
                  <td className={`${td} w-[4.5rem] min-w-[4.5rem] text-center`}>
                    <SynthesisCell {...row.total} />
                  </td>
                  {phases.map((phase) => (
                    <td
                      key={phase.id}
                      className={`${td} w-[4.5rem] min-w-[4.5rem] text-center`}
                    >
                      <SynthesisCell {...(row.byPhase[phase.id] ?? {
                        conformCount: 0,
                        nonConformCount: 0,
                        totalControls: 0,
                        conformityRatio: null,
                      })} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className={td} colSpan={3}>
                  TOTAL opération
                </td>
                <td className={`${td} text-center`}>
                  <SynthesisCell {...projectTotal} />
                </td>
                {phases.map((phase) => {
                  const phaseTotals = rows.reduce(
                    (acc, row) => {
                      const cell = row.byPhase[phase.id];
                      if (!cell) return acc;
                      acc.conformCount += cell.conformCount;
                      acc.nonConformCount += cell.nonConformCount;
                      acc.totalControls += cell.totalControls;
                      return acc;
                    },
                    {
                      conformCount: 0,
                      nonConformCount: 0,
                      totalControls: 0,
                      conformityRatio: null as number | null,
                    }
                  );
                  phaseTotals.conformityRatio =
                    phaseTotals.totalControls > 0
                      ? Math.round(
                          (phaseTotals.conformCount / phaseTotals.totalControls) *
                            100
                        )
                      : null;
                  return (
                    <td key={phase.id} className={`${td} text-center`}>
                      <SynthesisCell {...phaseTotals} />
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

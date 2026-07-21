"use client";

import { useMemo } from "react";
import { PrintReportBanner } from "@/components/print/PrintReportBanner";
import { TableExportToolbar } from "@/components/print/TableExportToolbar";
import { formatCurrency } from "@/lib/finance/calculations";
import type { ExcelColumn } from "@/lib/print/table-export";
import type { LotWithFinancials, Project } from "@/lib/types/database";

type ProrataPanelProps = {
  project: Project;
  lots: LotWithFinancials[];
};

function formatProrataPercent(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(value);
}

function buildProrataExport(lots: LotWithFinancials[]): {
  columns: ExcelColumn[];
  rows: ExcelColumn[][];
} {
  const columns: ExcelColumn[] = [
    { header: "Lot", value: "" },
    { header: "Entreprise", value: "" },
    { header: "% Prorata", value: "" },
    { header: "Retenue cumulée H.T.", value: "" },
    { header: "Retenue cumulée T.T.C.", value: "" },
    { header: "Dernière situation", value: "" },
  ];

  let totalRetenue = 0;
  const rows = lots.map((lot) => {
    const latest = lot.situations?.[lot.situations.length - 1];
    const prorataPercent = Number(lot.prorata_percent);
    const retenueHt = latest ? Number(latest.prorata_cumulative_ht) : 0;
    const retenueTtc = retenueHt * (1 + Number(lot.vat_rate) / 100);
    totalRetenue += retenueHt;

    return [
      { header: "Lot", value: lot.lot_number ?? "" },
      { header: "Entreprise", value: lot.name },
      { header: "% Prorata", value: formatProrataPercent(prorataPercent) },
      {
        header: "Retenue cumulée H.T.",
        value: retenueHt !== 0 ? formatCurrency(retenueHt) : "—",
      },
      {
        header: "Retenue cumulée T.T.C.",
        value: retenueTtc !== 0 ? formatCurrency(retenueTtc) : "—",
      },
      {
        header: "Dernière situation",
        value: latest?.situation_date
          ? new Date(latest.situation_date).toLocaleDateString("fr-FR")
          : "—",
      },
    ];
  });

  rows.push([
    { header: "Lot", value: "Total retenue cumulée H.T." },
    { header: "Entreprise", value: "" },
    { header: "% Prorata", value: "" },
    { header: "Retenue cumulée H.T.", value: formatCurrency(totalRetenue) },
    { header: "Retenue cumulée T.T.C.", value: "" },
    { header: "Dernière situation", value: "" },
  ]);

  return { columns, rows };
}

function ProrataTable({
  lots,
  compact = false,
}: {
  lots: LotWithFinancials[];
  compact?: boolean;
}) {
  let totalRetenue = 0;

  const rows = lots.map((lot) => {
    const latest = lot.situations?.[lot.situations.length - 1];
    const prorataPercent = Number(lot.prorata_percent);
    const retenueHt = latest ? Number(latest.prorata_cumulative_ht) : 0;
    const retenueTtc = retenueHt * (1 + Number(lot.vat_rate) / 100);
    totalRetenue += retenueHt;

    return {
      lot,
      prorataPercent,
      retenueHt,
      retenueTtc,
      latestDate: latest?.situation_date ?? null,
    };
  });

  const cellClass = compact ? "px-2 py-1.5 text-xs" : "px-3 py-2";

  if (lots.length === 0) {
    return <p className="text-sm text-slate-500">Aucun lot configuré.</p>;
  }

  return (
    <table className={`w-full min-w-[900px] text-left ${compact ? "text-xs" : "text-sm"}`}>
      <thead>
        <tr className="border-b border-slate-200 text-slate-500">
          <th className={`${cellClass} font-medium`}>Lot</th>
          <th className={`${cellClass} font-medium`}>Entreprise</th>
          <th className={`${cellClass} font-medium text-right`}>% Prorata</th>
          <th className={`${cellClass} font-medium text-right`}>Retenue cumulée H.T.</th>
          <th className={`${cellClass} font-medium text-right`}>Retenue cumulée T.T.C.</th>
          <th className={`${cellClass} font-medium`}>Dernière situation</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ lot, prorataPercent, retenueHt, retenueTtc, latestDate }) => (
          <tr key={lot.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className={`${cellClass} font-medium whitespace-nowrap`}>{lot.lot_number}</td>
            <td className={cellClass}>{lot.name}</td>
            <td className={`${cellClass} text-right tabular-nums`}>
              {formatProrataPercent(prorataPercent)}
            </td>
            <td className={`${cellClass} text-right tabular-nums`}>
              {retenueHt !== 0 ? formatCurrency(retenueHt) : "—"}
            </td>
            <td className={`${cellClass} text-right tabular-nums`}>
              {retenueTtc !== 0 ? formatCurrency(retenueTtc) : "—"}
            </td>
            <td className={cellClass}>
              {latestDate ? new Date(latestDate).toLocaleDateString("fr-FR") : "—"}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-slate-300 font-semibold">
          <td colSpan={3} className={`${cellClass} py-3`}>
            Total retenue cumulée H.T.
          </td>
          <td className={`${cellClass} py-3 text-right`}>{formatCurrency(totalRetenue)}</td>
          <td colSpan={2} />
        </tr>
      </tfoot>
    </table>
  );
}

export function ProrataPanel({ project, lots }: ProrataPanelProps) {
  const printRootId = `prorata-print-${project.id}`;
  const exportData = useMemo(() => buildProrataExport(lots), [lots]);

  return (
    <section className="relative overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
      <TableExportToolbar
        printRootId={printRootId}
        excelFilename={`suivi-prorata-${project.name}.csv`}
        excelColumns={exportData.columns}
        excelRows={exportData.rows}
        disabled={lots.length === 0}
        className="mb-4"
      />

      <h2 className="mb-1 text-lg font-semibold text-slate-900 no-print">Suivi ProRata</h2>
      <p className="mb-4 text-sm text-slate-500 no-print">{project.name}</p>

      <ProrataTable lots={lots} />

      <div
        id={printRootId}
        aria-hidden
        className="pointer-events-none absolute top-0 -left-[10000px] w-[297mm] bg-white p-4"
      >
        <PrintReportBanner title="SUIVI PRORATA" project={project} />
        <ProrataTable lots={lots} compact />
      </div>
    </section>
  );
}

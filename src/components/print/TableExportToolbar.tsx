"use client";

import { triggerBrowserPrint, downloadExcelCsv, type ExcelColumn } from "@/lib/print/table-export";

type TableExportToolbarProps = {
  printRootId: string;
  excelFilename: string;
  excelColumns: ExcelColumn[];
  excelRows: ExcelColumn[][];
  disabled?: boolean;
  className?: string;
};

export function TableExportToolbar({
  printRootId,
  excelFilename,
  excelColumns,
  excelRows,
  disabled = false,
  className = "",
}: TableExportToolbarProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <button
        type="button"
        disabled={disabled || excelRows.length === 0}
        onClick={() => triggerBrowserPrint(printRootId)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
      >
        Imprimer
      </button>
      <button
        type="button"
        disabled={disabled || excelRows.length === 0}
        onClick={() => triggerBrowserPrint(printRootId)}
        title="Ouvre la boîte d'impression — choisissez « Enregistrer au format PDF »"
        className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50"
      >
        Imprimer en PDF
      </button>
      <button
        type="button"
        disabled={disabled || excelRows.length === 0}
        onClick={() => downloadExcelCsv(excelFilename, excelColumns, excelRows)}
        className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        Export Excel
      </button>
    </div>
  );
}

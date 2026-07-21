"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deletePrevisionnelColumn,
  savePrevisionnelCell,
  savePrevisionnelComment,
  upsertPrevisionnelColumn,
} from "@/lib/actions/previsionnel";
import { formatCurrency } from "@/lib/finance/calculations";
import { evaluateFormula, isFormula } from "@/lib/finance/formula";
import { PrintReportBanner } from "@/components/print/PrintReportBanner";
import { TableExportToolbar } from "@/components/print/TableExportToolbar";
import type { ExcelColumn } from "@/lib/print/table-export";
import {
  computeCellValue,
  computeColumnTotal,
  expandColumns,
  getLotTotalMarketHt,
  type RenderedColumn,
} from "@/lib/finance/previsionnel-calculations";
import type {
  FinancialPrevisionnelCell,
  FinancialPrevisionnelColumn,
  FinancialPrevisionnelComment,
  LotWithFinancials,
  PrevisionnelColumnType,
  Project,
} from "@/lib/types/database";
import { PREVISIONNEL_COLUMN_TYPE_LABELS as COLUMN_LABELS } from "@/lib/types/database";

type PrevisionnelPanelProps = {
  project: Project;
  lots: LotWithFinancials[];
  columns: FinancialPrevisionnelColumn[];
  cells: FinancialPrevisionnelCell[];
  comments: FinancialPrevisionnelComment[];
};

const COLUMN_TYPES: PrevisionnelColumnType[] = [
  "situation_amount",
  "situation_percent",
  "manual_cumulative",
  "manual_monthly",
  "manual_percent",
];

function monthInputValue(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthInputToEndOfMonth(value: string): string | null {
  if (!value) return null;
  const [yearStr, monthStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return null;
  const lastDay = new Date(year, month, 0);
  return lastDay.toISOString().slice(0, 10);
}

function getColSpan(column: FinancialPrevisionnelColumn): number {
  if (column.column_type === "manual_monthly" || column.column_type === "manual_percent") {
    return 2;
  }
  return 1;
}

type EditableCellProps = {
  value: string;
  savedValue: string;
  isPercent?: boolean;
  marketHt: number;
  onSave: (raw: string) => Promise<void>;
};

function EditableCell({ value, savedValue, isPercent, marketHt, onSave }: EditableCellProps) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const isDirty = draft !== savedValue;

  const preview = useMemo(() => {
    if (!draft.trim()) return null;
    const result = evaluateFormula(draft, { marketHt });
    if (result === null) return "Formule invalide";
    if (isPercent) {
      return `${result.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} %`;
    }
    return `${result.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`;
  }, [draft, isPercent, marketHt]);

  return (
    <div className="min-w-[120px]">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={async () => {
          setFocused(false);
          if (draft !== savedValue) {
            await onSave(draft);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder={isPercent ? "ex: 45 ou =50-5" : "ex: 1500 ou =MARCHE*0.5"}
        className={`w-full rounded border px-2 py-1 text-right text-sm outline-none ${
          isDirty ? "border-violet-400 text-violet-700" : "border-slate-200"
        } ${isFormula(draft) ? "font-mono text-xs" : ""}`}
        title="Formules acceptées : =1500+200, =MARCHE*0.5"
      />
      {focused && preview && (
        <p className="mt-0.5 text-right text-xs text-slate-400">{preview}</p>
      )}
    </div>
  );
}

type CommentCellProps = {
  value: string;
  savedValue: string;
  onSave: (value: string) => Promise<void>;
};

function CommentCell({ value, savedValue, onSave }: CommentCellProps) {
  const [draft, setDraft] = useState(value);
  const isDirty = draft !== savedValue;

  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={async () => {
        if (draft !== savedValue) {
          await onSave(draft);
        }
      }}
      rows={1}
      placeholder="Commentaire…"
      className={`w-full min-w-[140px] resize-y rounded border px-2 py-1 text-sm outline-none ${
        isDirty ? "border-violet-400 text-violet-700" : "border-slate-200"
      }`}
    />
  );
}

export function PrevisionnelPanel({
  project,
  lots,
  columns: initialColumns,
  cells: initialCells,
  comments: initialComments,
}: PrevisionnelPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [columns, setColumns] = useState(initialColumns);
  const [cells, setCells] = useState(initialCells);
  const [comments, setComments] = useState(initialComments);

  const renderedColumns = useMemo(() => expandColumns(columns), [columns]);

  const configColumns = useMemo(
    () => [...columns].sort((a, b) => a.sort_order - b.sort_order),
    [columns]
  );

  const getComment = useCallback(
    (enterpriseId: string) =>
      comments.find((c) => c.enterprise_id === enterpriseId)?.comment ?? "",
    [comments]
  );

  const getCellRaw = useCallback(
    (columnId: string, enterpriseId: string) =>
      cells.find((c) => c.column_id === columnId && c.enterprise_id === enterpriseId)
        ?.raw_value ?? "",
    [cells]
  );

  const handleColumnTypeChange = (column: FinancialPrevisionnelColumn, type: PrevisionnelColumnType) => {
    startTransition(async () => {
      await upsertPrevisionnelColumn(project.id, {
        id: column.id,
        column_type: type,
        month_date: column.month_date,
        label: column.label,
      });
      setColumns((prev) =>
        prev.map((c) => (c.id === column.id ? { ...c, column_type: type } : c))
      );
      router.refresh();
    });
  };

  const handleColumnMonthChange = (column: FinancialPrevisionnelColumn, monthValue: string) => {
    const monthDate = monthInputToEndOfMonth(monthValue);
    startTransition(async () => {
      await upsertPrevisionnelColumn(project.id, {
        id: column.id,
        column_type: column.column_type,
        month_date: monthDate,
        label: column.label,
      });
      setColumns((prev) =>
        prev.map((c) => (c.id === column.id ? { ...c, month_date: monthDate } : c))
      );
      router.refresh();
    });
  };

  const handleAddColumn = () => {
    startTransition(async () => {
      await upsertPrevisionnelColumn(project.id, {
        column_type: "manual_cumulative",
        month_date: null,
      });
      router.refresh();
    });
  };

  const handleDeleteColumn = (columnId: string) => {
    if (!confirm("Supprimer cette colonne et ses données ?")) return;
    startTransition(async () => {
      await deletePrevisionnelColumn(project.id, columnId);
      setColumns((prev) => prev.filter((c) => c.id !== columnId));
      setCells((prev) => prev.filter((c) => c.column_id !== columnId));
      router.refresh();
    });
  };

  const handleSaveCell = async (columnId: string, enterpriseId: string, raw: string) => {
    await savePrevisionnelCell(project.id, columnId, enterpriseId, raw || null);
    setCells((prev) => {
      const filtered = prev.filter(
        (c) => !(c.column_id === columnId && c.enterprise_id === enterpriseId)
      );
      if (raw.trim()) {
        return [
          ...filtered,
          {
            id: `local-${columnId}-${enterpriseId}`,
            column_id: columnId,
            enterprise_id: enterpriseId,
            raw_value: raw.trim(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      }
      return filtered;
    });
    router.refresh();
  };

  const handleSaveComment = async (enterpriseId: string, comment: string) => {
    await savePrevisionnelComment(project.id, enterpriseId, comment || null);
    setComments((prev) => {
      const filtered = prev.filter((c) => c.enterprise_id !== enterpriseId);
      if (comment.trim()) {
        return [
          ...filtered,
          {
            id: `local-${enterpriseId}`,
            project_id: project.id,
            enterprise_id: enterpriseId,
            comment: comment.trim(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      }
      return filtered;
    });
    router.refresh();
  };

  const excelExport = useMemo(() => {
    const excelColumns: ExcelColumn[] = renderedColumns.map((col) => ({
      header: col.label,
      value: "",
    }));

    const excelRows: ExcelColumn[][] = lots.map((lot) =>
      renderedColumns.map((col) => {
        if (col.kind === "fixed") {
          if (col.key === "lot_number") {
            return { header: col.label, value: lot.lot_number ?? "" };
          }
          if (col.key === "designation") {
            return { header: col.label, value: lot.designation ?? "" };
          }
          if (col.key === "titulaire") {
            return { header: col.label, value: lot.name };
          }
          if (col.key === "market_ht") {
            return {
              header: col.label,
              value: formatCurrency(Number(lot.contract_amount_ht)),
            };
          }
          return { header: col.label, value: "" };
        }
        if (col.kind === "comment") {
          return { header: col.label, value: getComment(lot.id) || "" };
        }
        if (col.kind === "dynamic") {
          const configColumn = columns.find((c) => c.id === col.configColumnId);
          if (!configColumn) {
            return { header: col.label, value: "" };
          }
          return {
            header: col.label,
            value: computeCellValue(col, configColumn, columns, cells, lot).display,
          };
        }
        return { header: "", value: "" };
      })
    );

    return { columns: excelColumns, rows: excelRows };
  }, [renderedColumns, lots, columns, cells, getComment]);

  const safeExportName =
    project.name.replace(/[^\w\s-]/g, "").trim() || "previsionnel";

  const renderDynamicCell = (
    lot: LotWithFinancials,
    rendered: Extract<RenderedColumn, { kind: "dynamic" }>
  ) => {
    const configColumn = columns.find((c) => c.id === rendered.configColumnId);
    if (!configColumn) return "—";

    const cellValue = computeCellValue(rendered, configColumn, columns, cells, lot);
    const marketHt = getLotTotalMarketHt(lot);

    if (rendered.editable) {
      const raw = getCellRaw(configColumn.id, lot.id);
      const saved = initialCells.find(
        (c) => c.column_id === configColumn.id && c.enterprise_id === lot.id
      )?.raw_value ?? "";
      return (
        <EditableCell
          value={raw}
          savedValue={saved}
          isPercent={rendered.columnType === "manual_percent"}
          marketHt={marketHt}
          onSave={(value) => handleSaveCell(configColumn.id, lot.id, value)}
        />
      );
    }

    return (
      <span className={rendered.colorClass ?? ""}>{cellValue.display}</span>
    );
  };

  const tableContent = (forPrint: boolean) => (
    <table className={`w-full text-sm ${forPrint ? "min-w-[900px]" : "min-w-[1100px]"}`}>
      {!forPrint && (
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            <th colSpan={4} className="px-2 py-2" />
            {configColumns.map((column) => (
              <th
                key={`config-${column.id}`}
                colSpan={getColSpan(column)}
                className="border-l border-slate-200 px-2 py-2 align-top"
              >
                <div className="flex flex-col gap-1.5">
                  <select
                    value={column.column_type}
                    onChange={(e) =>
                      handleColumnTypeChange(column, e.target.value as PrevisionnelColumnType)
                    }
                    disabled={isPending}
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                  >
                    {COLUMN_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {COLUMN_LABELS[type]}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <input
                      type="month"
                      value={monthInputValue(column.month_date)}
                      onChange={(e) => handleColumnMonthChange(column, e.target.value)}
                      disabled={isPending}
                      className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
                      title="Mois de référence"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteColumn(column.id)}
                      disabled={isPending || configColumns.length <= 1}
                      className="rounded px-1.5 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-30"
                      title="Supprimer la colonne"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </th>
            ))}
            <th className="px-2 py-2" />
          </tr>
        </thead>
      )}
      <thead>
        <tr className={`border-b border-slate-300 text-left text-slate-600 ${forPrint ? "bg-white" : ""}`}>
          {renderedColumns.map((col) => (
            <th
              key={col.kind === "fixed" ? col.key : col.kind === "comment" ? col.key : col.columnId}
              className={`px-2 py-2 font-semibold ${
                col.kind === "dynamic" || col.kind === "fixed"
                  ? col.kind === "fixed" && col.key !== "lot_number" && col.key !== "designation" && col.key !== "titulaire"
                    ? "text-right"
                    : col.kind === "dynamic"
                      ? "text-right"
                      : ""
                  : ""
              } ${col.kind === "dynamic" && col.isCompanion ? "bg-slate-50 text-xs" : ""}`}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lots.map((lot, index) => (
          <tr
            key={lot.id}
            className={`border-b border-slate-100 ${index % 2 === 1 ? "bg-slate-50/60" : ""}`}
          >
            {renderedColumns.map((col) => {
              if (col.kind === "fixed") {
                if (col.key === "lot_number") {
                  return (
                    <td key={col.key} className="px-2 py-2 font-medium">
                      {lot.lot_number ?? "—"}
                    </td>
                  );
                }
                if (col.key === "designation") {
                  return (
                    <td key={col.key} className="px-2 py-2">
                      {lot.designation ?? "—"}
                    </td>
                  );
                }
                if (col.key === "titulaire") {
                  return (
                    <td key={col.key} className="px-2 py-2">
                      {lot.name}
                    </td>
                  );
                }
                if (col.key === "market_ht") {
                  return (
                    <td key={col.key} className="px-2 py-2 text-right">
                      {formatCurrency(Number(lot.contract_amount_ht))}
                    </td>
                  );
                }
                return null;
              }

              if (col.kind === "comment") {
                if (forPrint) {
                  return (
                    <td key="comment" className="px-2 py-2 text-sm">
                      {getComment(lot.id) || "—"}
                    </td>
                  );
                }
                const saved =
                  initialComments.find((c) => c.enterprise_id === lot.id)?.comment ?? "";
                return (
                  <td key="comment" className="px-2 py-2">
                    <CommentCell
                      value={getComment(lot.id)}
                      savedValue={saved}
                      onSave={(value) => handleSaveComment(lot.id, value)}
                    />
                  </td>
                );
              }

              if (col.kind !== "dynamic") return null;

              return (
                <td
                  key={col.columnId}
                  className={`px-2 py-2 text-right ${col.isCompanion ? "bg-slate-50/80" : ""}`}
                >
                  {forPrint
                    ? computeCellValue(
                        col,
                        columns.find((c) => c.id === col.configColumnId)!,
                        columns,
                        cells,
                        lot
                      ).display
                    : renderDynamicCell(lot, col)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-slate-400 font-semibold text-slate-900">
          <td colSpan={4} className="px-2 py-3">
            Total H.T.
          </td>
          {renderedColumns
            .filter((col): col is Extract<RenderedColumn, { kind: "dynamic" }> => col.kind === "dynamic")
            .map((col) => {
              const configColumn = columns.find((c) => c.id === col.configColumnId);
              if (!configColumn) return <td key={col.columnId} />;
              const total = computeColumnTotal(col, configColumn, columns, cells, lots);
              return (
                <td
                  key={`total-${col.columnId}`}
                  className={`px-2 py-3 text-right ${col.colorClass ?? ""}`}
                >
                  {total.display}
                </td>
              );
            })}
          <td className="px-2 py-3" />
        </tr>
      </tfoot>
    </table>
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Tableau prévisionnel</h2>
          <p className="text-sm text-slate-500">{project.name}</p>
          <p className="mt-1 text-xs text-slate-400">
            Colonnes dynamiques configurables · Formules : =1500+200, =MARCHE*0.5
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleAddColumn}
            disabled={isPending}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            + Ajouter une colonne
          </button>
          <TableExportToolbar
            printRootId="previsionnel-print"
            excelFilename={`Previsionnel-${safeExportName}`}
            excelColumns={excelExport.columns}
            excelRows={excelExport.rows}
            disabled={lots.length === 0}
          />
        </div>
      </div>

      {lots.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">
          Aucun lot configuré. Ajoutez des lots dans l&apos;onglet Marché.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
          {tableContent(false)}
        </div>
      )}

      <div id="previsionnel-print" className="pointer-events-none fixed -left-[9999px] top-0">
        <div className="bg-white p-8" style={{ width: "297mm" }}>
          <PrintReportBanner title="TABLEAU PREVISIONNEL" project={project} />
          {lots.length > 0 && tableContent(true)}
        </div>
      </div>
    </section>
  );
}

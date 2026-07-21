import { computeAmendmentsTotals } from "@/lib/finance/calculations";
import { evaluateFormula } from "@/lib/finance/formula";
import type {
  FinancialPrevisionnelCell,
  FinancialPrevisionnelColumn,
  LotWithFinancials,
  PrevisionnelColumnType,
} from "@/lib/types/database";

export type RenderedColumn =
  | {
      kind: "fixed";
      key: string;
      label: string;
      width?: string;
    }
  | {
      kind: "dynamic";
      columnId: string;
      configColumnId: string;
      columnType: PrevisionnelColumnType;
      monthDate: string | null;
      label: string;
      editable: boolean;
      isCompanion: boolean;
      companionRole?: "monthly_cumulative" | "percent_ht";
      colorClass?: string;
    }
  | {
      kind: "comment";
      key: "comment";
      label: string;
    };

export function getEndOfMonthDate(year: number, month: number): string {
  const lastDay = new Date(year, month, 0);
  return lastDay.toISOString().slice(0, 10);
}

export function getDefaultMonthDates(reference = new Date()): {
  previousMonth: string;
  nextMonth: string;
  monthAfter: string;
} {
  const year = reference.getFullYear();
  const month = reference.getMonth() + 1;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonthNum = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const afterMonthNum = nextMonthNum === 12 ? 1 : nextMonthNum + 1;
  const afterYear = nextMonthNum === 12 ? nextYear + 1 : nextYear;

  return {
    previousMonth: getEndOfMonthDate(prevYear, prevMonth),
    nextMonth: getEndOfMonthDate(nextYear, nextMonthNum),
    monthAfter: getEndOfMonthDate(afterYear, afterMonthNum),
  };
}

export function formatMonthLabel(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function getLotTotalMarketHt(lot: LotWithFinancials): number {
  const { totalHt: amendmentsHt } = computeAmendmentsTotals(lot.amendments ?? []);
  return Number(lot.contract_amount_ht) + amendmentsHt;
}

function getSituationAtMonth(lot: LotWithFinancials, monthDate: string | null) {
  if (!monthDate) return null;
  const situations = lot.situations ?? [];
  const target = new Date(monthDate);
  let best: (typeof situations)[number] | null = null;
  for (const situation of situations) {
    const date = new Date(situation.situation_date);
    if (date <= target) {
      if (!best || new Date(best.situation_date) < date) {
        best = situation;
      }
    }
  }
  return best;
}

function getSituationCumulativeHt(lot: LotWithFinancials, monthDate: string | null): number | null {
  const situation = getSituationAtMonth(lot, monthDate);
  if (!situation) return null;
  return (
    Number(situation.works_cumulative_ht) + Number(situation.amendment_works_cumulative_ht)
  );
}

function getSituationCumulativePercent(
  lot: LotWithFinancials,
  monthDate: string | null
): number | null {
  const cumulative = getSituationCumulativeHt(lot, monthDate);
  const totalMarket = getLotTotalMarketHt(lot);
  if (cumulative === null || totalMarket <= 0) return null;
  return (cumulative / totalMarket) * 100;
}

function getCellRaw(
  cells: FinancialPrevisionnelCell[],
  columnId: string,
  enterpriseId: string
): string | null {
  return cells.find((c) => c.column_id === columnId && c.enterprise_id === enterpriseId)
    ?.raw_value ?? null;
}

function getManualValue(
  cells: FinancialPrevisionnelCell[],
  columnId: string,
  enterpriseId: string,
  marketHt: number
): number | null {
  const raw = getCellRaw(cells, columnId, enterpriseId);
  if (!raw?.trim()) return null;
  return evaluateFormula(raw, { marketHt });
}

export function buildColumnLabel(column: FinancialPrevisionnelColumn): string {
  if (column.label?.trim()) return column.label.trim();
  const month = formatMonthLabel(column.month_date);
  switch (column.column_type) {
    case "situation_amount":
      return month ? `Facturation au réel fin ${month} HT` : "Montant cumulé situations HT";
    case "situation_percent":
      return month ? `% cumulé situations fin ${month}` : "% cumulé situations";
    case "manual_cumulative":
      return month ? `Prévisionnel fin ${month} HT` : "Montant cumulé HT";
    case "manual_monthly":
      return month ? `Facturé ${month} HT` : "Montant du mois HT";
    case "manual_percent":
      return month ? `% cumulé fin ${month}` : "% cumulé";
    default:
      return "Colonne";
  }
}

export function expandColumns(columns: FinancialPrevisionnelColumn[]): RenderedColumn[] {
  const fixed: RenderedColumn[] = [
    { kind: "fixed", key: "lot_number", label: "N°", width: "w-12" },
    { kind: "fixed", key: "designation", label: "Désignation des travaux" },
    { kind: "fixed", key: "titulaire", label: "Titulaire lot" },
    { kind: "fixed", key: "market_ht", label: "Montant du marché HT" },
  ];

  const sorted = [...columns].sort((a, b) => a.sort_order - b.sort_order);
  const dynamic: RenderedColumn[] = [];

  for (const column of sorted) {
    const baseLabel = buildColumnLabel(column);
    const monthDate = column.month_date;

    if (column.column_type === "manual_percent") {
      dynamic.push({
        kind: "dynamic",
        columnId: `${column.id}__ht`,
        configColumnId: column.id,
        columnType: column.column_type,
        monthDate,
        label: monthDate
          ? `Cumul HT fin ${formatMonthLabel(monthDate)}`
          : "Cumul HT",
        editable: false,
        isCompanion: true,
        companionRole: "percent_ht",
        colorClass: "text-emerald-700",
      });
      dynamic.push({
        kind: "dynamic",
        columnId: column.id,
        configColumnId: column.id,
        columnType: column.column_type,
        monthDate,
        label: baseLabel,
        editable: true,
        isCompanion: false,
        colorClass: "text-emerald-700",
      });
    } else if (column.column_type === "manual_monthly") {
      dynamic.push({
        kind: "dynamic",
        columnId: column.id,
        configColumnId: column.id,
        columnType: column.column_type,
        monthDate,
        label: baseLabel,
        editable: true,
        isCompanion: false,
        colorClass: "text-emerald-700",
      });
      dynamic.push({
        kind: "dynamic",
        columnId: `${column.id}__cumul`,
        configColumnId: column.id,
        columnType: column.column_type,
        monthDate,
        label: monthDate
          ? `Cumulé fin ${formatMonthLabel(monthDate)} HT`
          : "Cumulé HT",
        editable: false,
        isCompanion: true,
        companionRole: "monthly_cumulative",
        colorClass: "text-emerald-700",
      });
    } else {
      const colorClass =
        column.column_type === "situation_amount" || column.column_type === "situation_percent"
          ? "text-blue-700"
          : "text-emerald-700";
      dynamic.push({
        kind: "dynamic",
        columnId: column.id,
        configColumnId: column.id,
        columnType: column.column_type,
        monthDate,
        label: baseLabel,
        editable: column.column_type === "manual_cumulative",
        isCompanion: false,
        colorClass,
      });
    }
  }

  return [
    ...fixed,
    ...dynamic,
    { kind: "comment", key: "comment", label: "Commentaire" },
  ];
}

export type CellValue = {
  display: string;
  numeric: number | null;
  raw: string | null;
  isPercent: boolean;
};

export function computeMonthlyRunningCumulative(
  columns: FinancialPrevisionnelColumn[],
  cells: FinancialPrevisionnelCell[],
  lot: LotWithFinancials,
  upToColumnId: string
): number {
  const sorted = [...columns]
    .filter((c) => c.column_type === "manual_monthly")
    .sort((a, b) => a.sort_order - b.sort_order);

  const marketHt = getLotTotalMarketHt(lot);
  let cumulative = 0;

  for (const column of sorted) {
    const value = getManualValue(cells, column.id, lot.id, marketHt);
    if (value !== null) cumulative += value;
    if (column.id === upToColumnId) break;
  }

  return cumulative;
}

export function computeCellValue(
  rendered: Extract<RenderedColumn, { kind: "dynamic" }>,
  column: FinancialPrevisionnelColumn,
  allColumns: FinancialPrevisionnelColumn[],
  cells: FinancialPrevisionnelCell[],
  lot: LotWithFinancials
): CellValue {
  const marketHt = getLotTotalMarketHt(lot);
  const isPercent =
    rendered.columnType === "situation_percent" || rendered.columnType === "manual_percent";

  if (rendered.isCompanion && rendered.companionRole === "percent_ht") {
    const percent = getManualValue(cells, column.id, lot.id, marketHt);
    if (percent === null) {
      return { display: "—", numeric: null, raw: null, isPercent: false };
    }
    const ht = (percent / 100) * marketHt;
    return {
      display: formatAmount(ht),
      numeric: ht,
      raw: null,
      isPercent: false,
    };
  }

  if (rendered.isCompanion && rendered.companionRole === "monthly_cumulative") {
    const cumulative = computeMonthlyRunningCumulative(allColumns, cells, lot, column.id);
    return {
      display: formatAmount(cumulative),
      numeric: cumulative,
      raw: null,
      isPercent: false,
    };
  }

  switch (rendered.columnType) {
    case "situation_amount": {
      const value = getSituationCumulativeHt(lot, rendered.monthDate);
      return {
        display: value === null ? "—" : formatAmount(value),
        numeric: value,
        raw: null,
        isPercent: false,
      };
    }
    case "situation_percent": {
      const value = getSituationCumulativePercent(lot, rendered.monthDate);
      return {
        display: value === null ? "—" : formatPercent(value),
        numeric: value,
        raw: null,
        isPercent: true,
      };
    }
    case "manual_cumulative":
    case "manual_monthly":
    case "manual_percent": {
      const raw = getCellRaw(cells, column.id, lot.id);
      const value = getManualValue(cells, column.id, lot.id, marketHt);
      if (!raw?.trim()) {
        return { display: "—", numeric: null, raw: null, isPercent: isPercent && !rendered.isCompanion };
      }
      return {
        display: isPercent ? formatPercent(value ?? 0) : formatAmount(value),
        numeric: value,
        raw,
        isPercent,
      };
    }
    default:
      return { display: "—", numeric: null, raw: null, isPercent: false };
  }
}

function formatAmount(value: number | null): string {
  if (value === null) return "—";
  return (
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + " €"
  );
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return (
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + " %"
  );
}

export function computeColumnTotal(
  rendered: Extract<RenderedColumn, { kind: "dynamic" }>,
  column: FinancialPrevisionnelColumn,
  allColumns: FinancialPrevisionnelColumn[],
  cells: FinancialPrevisionnelCell[],
  lots: LotWithFinancials[]
): CellValue {
  if (rendered.columnType === "situation_percent" || rendered.columnType === "manual_percent") {
    let totalMarket = 0;
    let weightedSum = 0;
    for (const lot of lots) {
      const market = getLotTotalMarketHt(lot);
      const cell = computeCellValue(rendered, column, allColumns, cells, lot);
      if (cell.numeric !== null) {
        totalMarket += market;
        weightedSum += (cell.numeric / 100) * market;
      }
    }
    if (totalMarket <= 0) {
      return { display: "—", numeric: null, raw: null, isPercent: true };
    }
    const percent = (weightedSum / totalMarket) * 100;
    return {
      display: formatPercent(percent),
      numeric: percent,
      raw: null,
      isPercent: true,
    };
  }

  let total = 0;
  let hasValue = false;
  for (const lot of lots) {
    const cell = computeCellValue(rendered, column, allColumns, cells, lot);
    if (cell.numeric !== null) {
      total += cell.numeric;
      hasValue = true;
    }
  }
  return {
    display: hasValue ? formatAmount(total) : "—",
    numeric: hasValue ? total : null,
    raw: null,
    isPercent: false,
  };
}

export { getLotTotalMarketHt };

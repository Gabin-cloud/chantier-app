"use server";

import { revalidatePath } from "next/cache";
import { requireFinanceAccess } from "@/lib/actions/members";
import { getDefaultMonthDates } from "@/lib/finance/previsionnel-calculations";
import { createClient } from "@/lib/supabase/server";
import type {
  FinancialPrevisionnelColumn,
  PrevisionnelColumnType,
  PrevisionnelData,
} from "@/lib/types/database";

function previsionnelPaths(projectId: string) {
  return [`/pc/projets/${projectId}/suivi-financier/previsionnel`];
}

function revalidatePrevisionnel(projectId: string) {
  for (const path of previsionnelPaths(projectId)) {
    revalidatePath(path);
  }
}

async function ensureDefaultColumns(projectId: string): Promise<FinancialPrevisionnelColumn[]> {
  const supabase = await createClient();
  const { data: existing, error } = await supabase
    .from("financial_previsionnel_columns")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");

  if (error) throw new Error(error.message);
  if (existing && existing.length > 0) {
    return existing as FinancialPrevisionnelColumn[];
  }

  const { previousMonth, nextMonth, monthAfter } = getDefaultMonthDates();
  const defaults: Array<{
    column_type: PrevisionnelColumnType;
    month_date: string;
    sort_order: number;
  }> = [
    { column_type: "situation_amount", month_date: previousMonth, sort_order: 0 },
    { column_type: "manual_cumulative", month_date: nextMonth, sort_order: 1 },
    { column_type: "manual_cumulative", month_date: monthAfter, sort_order: 2 },
  ];

  const { data: inserted, error: insertError } = await supabase
    .from("financial_previsionnel_columns")
    .insert(defaults.map((d) => ({ ...d, project_id: projectId })))
    .select("*");

  if (insertError) throw new Error(insertError.message);
  return (inserted ?? []) as FinancialPrevisionnelColumn[];
}

export async function getPrevisionnelData(projectId: string): Promise<PrevisionnelData> {
  await requireFinanceAccess(projectId);
  const supabase = await createClient();

  const columns = await ensureDefaultColumns(projectId);

  const { data: cells, error: cellsError } = await supabase
    .from("financial_previsionnel_cells")
    .select("*")
    .in(
      "column_id",
      columns.map((c) => c.id)
    );

  if (cellsError) throw new Error(cellsError.message);

  const { data: comments, error: commentsError } = await supabase
    .from("financial_previsionnel_comments")
    .select("*")
    .eq("project_id", projectId);

  if (commentsError) throw new Error(commentsError.message);

  return {
    columns,
    cells: cells ?? [],
    comments: comments ?? [],
  };
}

export async function upsertPrevisionnelColumn(
  projectId: string,
  input: {
    id?: string;
    column_type: PrevisionnelColumnType;
    month_date?: string | null;
    label?: string | null;
    sort_order?: number;
  }
) {
  await requireFinanceAccess(projectId);
  const supabase = await createClient();

  if (input.id) {
    const { error } = await supabase
      .from("financial_previsionnel_columns")
      .update({
        column_type: input.column_type,
        month_date: input.month_date ?? null,
        label: input.label ?? null,
        ...(input.sort_order !== undefined ? { sort_order: input.sort_order } : {}),
      })
      .eq("id", input.id)
      .eq("project_id", projectId);

    if (error) throw new Error(error.message);
  } else {
    const { data: existing } = await supabase
      .from("financial_previsionnel_columns")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder =
      input.sort_order ?? ((existing?.[0]?.sort_order as number | undefined) ?? -1) + 1;

    const { error } = await supabase.from("financial_previsionnel_columns").insert({
      project_id: projectId,
      column_type: input.column_type,
      month_date: input.month_date ?? null,
      label: input.label ?? null,
      sort_order: nextOrder,
    });

    if (error) throw new Error(error.message);
  }

  revalidatePrevisionnel(projectId);
}

export async function deletePrevisionnelColumn(projectId: string, columnId: string) {
  await requireFinanceAccess(projectId);
  const supabase = await createClient();

  const { error } = await supabase
    .from("financial_previsionnel_columns")
    .delete()
    .eq("id", columnId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);
  revalidatePrevisionnel(projectId);
}

export async function savePrevisionnelCell(
  projectId: string,
  columnId: string,
  enterpriseId: string,
  rawValue: string | null
) {
  await requireFinanceAccess(projectId);
  const supabase = await createClient();

  const trimmed = rawValue?.trim() ?? "";

  if (!trimmed) {
    const { error } = await supabase
      .from("financial_previsionnel_cells")
      .delete()
      .eq("column_id", columnId)
      .eq("enterprise_id", enterpriseId);

    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("financial_previsionnel_cells").upsert(
      {
        column_id: columnId,
        enterprise_id: enterpriseId,
        raw_value: trimmed,
      },
      { onConflict: "column_id,enterprise_id" }
    );

    if (error) throw new Error(error.message);
  }

  revalidatePrevisionnel(projectId);
}

export async function savePrevisionnelComment(
  projectId: string,
  enterpriseId: string,
  comment: string | null
) {
  await requireFinanceAccess(projectId);
  const supabase = await createClient();

  const trimmed = comment?.trim() ?? "";

  if (!trimmed) {
    const { error } = await supabase
      .from("financial_previsionnel_comments")
      .delete()
      .eq("project_id", projectId)
      .eq("enterprise_id", enterpriseId);

    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("financial_previsionnel_comments").upsert(
      {
        project_id: projectId,
        enterprise_id: enterpriseId,
        comment: trimmed,
      },
      { onConflict: "project_id,enterprise_id" }
    );

    if (error) throw new Error(error.message);
  }

  revalidatePrevisionnel(projectId);
}

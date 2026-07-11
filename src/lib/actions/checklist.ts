"use server";

import { revalidatePath } from "next/cache";
import { requireProjectAccess, requireProjectRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type {
  ChecklistItemStatus,
  DrawingStroke,
  PhaseChecklistItem,
  PlanDrawing,
  VisitChecklistResponse,
} from "@/lib/types/database";

async function getVisitContext(visitId: string) {
  const supabase = await createClient();
  const { data: visit, error } = await supabase
    .from("visits")
    .select("project_id, phase_id")
    .eq("id", visitId)
    .single();

  if (error) throw new Error(error.message);
  return { supabase, visit };
}

export async function getPlanDrawings(
  visitId: string,
  planId?: string
): Promise<PlanDrawing[]> {
  const { supabase, visit } = await getVisitContext(visitId);
  await requireProjectAccess(visit.project_id);

  if (visit.phase_id) {
    let query = supabase.from("plan_drawings").select("*").eq("phase_id", visit.phase_id);
    if (planId) query = query.eq("plan_id", planId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  let query = supabase.from("plan_drawings").select("*").eq("visit_id", visitId);
  if (planId) query = query.eq("plan_id", planId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function savePlanDrawings(
  visitId: string,
  projectId: string,
  planId: string,
  strokes: DrawingStroke[],
  pageNumber = 1
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const { supabase, visit } = await getVisitContext(visitId);

  const row: Record<string, unknown> = {
    visit_id: visitId,
    plan_id: planId,
    page_number: pageNumber,
    strokes,
  };

  if (visit.phase_id) {
    row.phase_id = visit.phase_id;
  }

  const conflict = visit.phase_id
    ? "phase_id,plan_id,page_number"
    : "visit_id,plan_id,page_number";

  const { data, error } = await supabase
    .from("plan_drawings")
    .upsert(row, { onConflict: conflict })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${projectId}/visites/${visitId}`);
  return data;
}

export async function getProjectChecklistItems(
  projectId: string
): Promise<PhaseChecklistItem[]> {
  try {
    await requireProjectAccess(projectId);
    const supabase = await createClient();
    const { data: phases } = await supabase
      .from("visit_phases")
      .select("id")
      .eq("project_id", projectId);

    if (!phases?.length) return [];

    const { data, error } = await supabase
      .from("phase_checklist_items")
      .select("*")
      .in(
        "phase_id",
        phases.map((p) => p.id)
      )
      .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function addPhaseChecklistItem(
  projectId: string,
  phaseId: string,
  label: string
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Le libellé est obligatoire.");

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("phase_checklist_items")
    .select("sort_order")
    .eq("phase_id", phaseId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("phase_checklist_items")
    .insert({
      phase_id: phaseId,
      label: trimmed,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
  return data;
}

export async function deletePhaseChecklistItem(
  projectId: string,
  itemId: string
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("phase_checklist_items")
    .delete()
    .eq("id", itemId);

  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
}

export async function getVisitChecklistResponses(
  visitId: string
): Promise<VisitChecklistResponse[]> {
  const { supabase, visit } = await getVisitContext(visitId);
  await requireProjectAccess(visit.project_id);

  const { data, error } = await supabase
    .from("visit_checklist_responses")
    .select("*")
    .eq("visit_id", visitId);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveVisitChecklistResponse(
  visitId: string,
  projectId: string,
  checklistItemId: string,
  status: ChecklistItemStatus,
  notes?: string
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("visit_checklist_responses")
    .upsert(
      {
        visit_id: visitId,
        checklist_item_id: checklistItemId,
        status,
        notes: notes?.trim() || null,
      },
      { onConflict: "visit_id,checklist_item_id" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${projectId}/visites/${visitId}`);
  return data;
}

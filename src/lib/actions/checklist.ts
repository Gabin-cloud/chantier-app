"use server";

import { revalidatePath } from "next/cache";
import { requireProjectAccess, requireProjectRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type {
  ChecklistItemStatus,
  ControlResult,
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
  label: string,
  zoneId?: string,
  zoneName?: string
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Le libellé est obligatoire.");

  const supabase = await createClient();

  let resolvedZoneId = zoneId || null;
  let resolvedZoneName = zoneName?.trim() || null;

  if (resolvedZoneId) {
    const { data: zone } = await supabase
      .from("phase_zones")
      .select("name")
      .eq("id", resolvedZoneId)
      .single();
    resolvedZoneName = zone?.name ?? resolvedZoneName;
  }

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
      zone_id: resolvedZoneId,
      zone_name: resolvedZoneName,
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
  try {
    const { supabase, visit } = await getVisitContext(visitId);
    await requireProjectAccess(visit.project_id);

    const { data, error } = await supabase
      .from("visit_checklist_responses")
      .select("*")
      .eq("visit_id", visitId);

    if (error) throw new Error(error.message);
    return data ?? [];
  } catch {
    return [];
  }
}

export type ControlBoardRow = {
  phaseId: string;
  phaseName: string;
  zoneName: string;
  itemId: string;
  itemLabel: string;
  lastControlDate: string | null;
  controlResult: ControlResult | null;
  enterpriseName: string | null;
  location: string | null;
  visitId: string | null;
};

export async function getProjectControlBoard(
  projectId: string
): Promise<ControlBoardRow[]> {
  await requireProjectAccess(projectId);
  const supabase = await createClient();

  const { data: phases } = await supabase
    .from("visit_phases")
    .select("id, name, sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (!phases?.length) return [];

  const phaseIds = phases.map((p) => p.id);
  const { data: items } = await supabase
    .from("phase_checklist_items")
    .select("*")
    .in("phase_id", phaseIds)
    .order("sort_order", { ascending: true });

  if (!items?.length) return [];

  const { data: markers } = await supabase
    .from("markers")
    .select(
      "phase_id, checklist_item_id, control_result, enterprise_id, location_label, location_preset_id, created_at, visit_id"
    )
    .in("phase_id", phaseIds)
    .not("checklist_item_id", "is", null)
    .order("created_at", { ascending: false });

  const { data: enterprises } = await supabase
    .from("enterprises")
    .select("id, name")
    .eq("project_id", projectId);

  const { data: locations } = await supabase
    .from("project_locations")
    .select("id, name")
    .eq("project_id", projectId);

  const enterpriseMap = new Map((enterprises ?? []).map((e) => [e.id, e.name]));
  const locationMap = new Map((locations ?? []).map((l) => [l.id, l.name]));
  const phaseMap = new Map(phases.map((p) => [p.id, p.name]));

  const { data: zones } = await supabase
    .from("phase_zones")
    .select("id, name, phase_id")
    .in("phase_id", phaseIds);

  const zoneMap = new Map((zones ?? []).map((z) => [z.id, z.name]));

  return items.map((item) => {
    const related = (markers ?? []).filter((m) => m.checklist_item_id === item.id);
    const latest = related[0];
    const zoneName =
      (item.zone_id ? zoneMap.get(item.zone_id) : null) ??
      item.zone_name ??
      "Général";

    return {
      phaseId: item.phase_id,
      phaseName: phaseMap.get(item.phase_id) ?? "Phase",
      zoneName,
      itemId: item.id,
      itemLabel: item.label,
      lastControlDate: latest?.created_at ?? null,
      controlResult: latest?.control_result ?? null,
      enterpriseName: latest?.enterprise_id
        ? enterpriseMap.get(latest.enterprise_id) ?? null
        : null,
      location:
        latest?.location_label ??
        (latest?.location_preset_id
          ? locationMap.get(latest.location_preset_id) ?? null
          : null),
      visitId: latest?.visit_id ?? null,
    };
  });
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

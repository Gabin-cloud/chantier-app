"use server";

import { revalidatePath } from "next/cache";
import { requireProjectRoles, requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { ensureDefaultPhases } from "@/lib/actions/phases";
import type { ControlLibraryItem, ControlResult } from "@/lib/types/database";

export async function getControlLibrary(): Promise<ControlLibraryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("control_library_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeLibraryItem);
}

function normalizeLibraryItem(row: Record<string, unknown>): ControlLibraryItem {
  const presets = row.preset_comments;
  return {
    id: row.id as string,
    phase_name: (row.phase_name as string) ?? "Gros œuvre",
    zone_name: row.zone_name as string,
    label: row.label as string,
    plan_support_name: (row.plan_support_name as string) ?? "",
    help_comment: (row.help_comment as string) ?? "",
    preset_comments: Array.isArray(presets) ? (presets as string[]) : [],
    sort_order: (row.sort_order as number) ?? 0,
    created_at: row.created_at as string,
  };
}

export async function saveControlLibraryItem(input: {
  id?: string;
  phase_name: string;
  label: string;
  plan_support_name?: string;
  help_comment?: string;
  preset_comments?: string[];
  sort_order?: number;
}): Promise<string> {
  await requireUser();
  const supabase = await createClient();

  const label = input.label.trim();
  if (!label) throw new Error("Le point de contrôle est obligatoire.");

  const payload = {
    phase_name: input.phase_name.trim() || "Gros œuvre",
    zone_name: "",
    label,
    plan_support_name: input.plan_support_name?.trim() ?? "",
    help_comment: input.help_comment?.trim() ?? "",
    preset_comments: input.preset_comments ?? [],
    sort_order: input.sort_order ?? 0,
  };

  if (input.id) {
    const { error } = await supabase
      .from("control_library_items")
      .update(payload)
      .eq("id", input.id);
    if (error) throw new Error(error.message);
    revalidatePath("/pc/referentiels");
    return input.id;
  }

  const { data: maxRow } = await supabase
    .from("control_library_items")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("control_library_items")
    .insert({
      ...payload,
      sort_order: input.sort_order ?? (maxRow?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/pc/referentiels");
  return data.id as string;
}

export async function deleteControlLibraryItem(itemId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("control_library_items")
    .delete()
    .eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath("/pc/referentiels");
}

async function resolvePlanTypeId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  planSupportName: string
): Promise<string | null> {
  const name = planSupportName.trim();
  if (!name) return null;

  const { data: existing } = await supabase
    .from("work_control_plan_types")
    .select("id")
    .eq("project_id", projectId)
    .eq("name", name)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: fuzzy } = await supabase
    .from("work_control_plan_types")
    .select("id, name")
    .eq("project_id", projectId);

  const match = (fuzzy ?? []).find(
    (t) => t.name.toLowerCase() === name.toLowerCase()
  );
  return match?.id ?? null;
}

export async function importControlLibraryToProject(projectId: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const library = await getControlLibrary();
  if (!library.length) throw new Error("La bibliothèque de contrôles est vide.");

  const phases = await ensureDefaultPhases(projectId);
  const phaseByName = new Map(phases.map((p) => [p.name.toLowerCase(), p]));

  let imported = 0;
  let updated = 0;

  for (const item of library) {
    const phase =
      phaseByName.get(item.phase_name.toLowerCase()) ??
      phases.find((p) =>
        p.name.toLowerCase().includes(item.phase_name.toLowerCase().split(" ")[0] ?? "")
      ) ??
      phases[0];

    if (!phase) continue;

    const planTypeId = await resolvePlanTypeId(
      supabase,
      projectId,
      item.plan_support_name
    );

    const payload = {
      phase_id: phase.id,
      zone_id: null,
      zone_name: null,
      label: item.label,
      library_item_id: item.id,
      plan_type_id: planTypeId,
      help_comment: item.help_comment,
      preset_comments: item.preset_comments,
    };

    const { data: byLibrary } = await supabase
      .from("phase_checklist_items")
      .select("id")
      .eq("phase_id", phase.id)
      .eq("library_item_id", item.id)
      .maybeSingle();

    if (byLibrary) {
      const { error } = await supabase
        .from("phase_checklist_items")
        .update(payload)
        .eq("id", byLibrary.id);
      if (!error) updated++;
      continue;
    }

    const { data: existing } = await supabase
      .from("phase_checklist_items")
      .select("id")
      .eq("phase_id", phase.id)
      .eq("label", item.label)
      .is("zone_id", null)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("phase_checklist_items")
        .update({ ...payload, library_item_id: item.id })
        .eq("id", existing.id);
      if (!error) updated++;
      continue;
    }

    const { data: last } = await supabase
      .from("phase_checklist_items")
      .select("sort_order")
      .eq("phase_id", phase.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("phase_checklist_items").insert({
      ...payload,
      sort_order: (last?.sort_order ?? 0) + 1,
    });

    if (!error) imported++;
  }

  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/controles`);
  revalidatePath(`/pc/projets/${projectId}/suivi-travaux/controle`);

  return { imported, updated, total: library.length };
}

export async function importControlLibraryToAllProjects() {
  await requireUser();
  const supabase = await createClient();
  const { data: projects, error } = await supabase.from("projects").select("id");
  if (error) throw new Error(error.message);

  let imported = 0;
  let updated = 0;

  for (const project of projects ?? []) {
    try {
      const result = await importControlLibraryToProject(project.id);
      imported += result.imported;
      updated += result.updated;
    } catch {
      // droits ou projet sans phases — on continue
    }
  }

  revalidatePath("/pc/referentiels");
  return {
    projectCount: projects?.length ?? 0,
    imported,
    updated,
  };
}

/** Statuts « à contrôler plus tard » / « en attente » reportés entre visites. */
export async function getProjectInheritedControlResults(
  projectId: string
): Promise<Record<string, ControlResult>> {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const supabase = await createClient();

  const { data: visits } = await supabase
    .from("visits")
    .select("id")
    .eq("project_id", projectId);

  const visitIds = (visits ?? []).map((v) => v.id);
  if (!visitIds.length) return {};

  const { data: markers, error } = await supabase
    .from("markers")
    .select("checklist_item_id, control_result, updated_at")
    .in("visit_id", visitIds)
    .in("control_result", ["deferred", "pending"])
    .not("checklist_item_id", "is", null)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const result: Record<string, ControlResult> = {};
  for (const marker of markers ?? []) {
    const itemId = marker.checklist_item_id as string;
    if (!result[itemId]) {
      result[itemId] = marker.control_result as ControlResult;
    }
  }
  return result;
}

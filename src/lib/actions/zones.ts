"use server";

import { revalidatePath } from "next/cache";
import { requireProjectAccess, requireProjectRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { PhaseZone } from "@/lib/types/database";

async function getPhaseProjectId(phaseId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visit_phases")
    .select("project_id")
    .eq("id", phaseId)
    .single();
  if (error) throw new Error(error.message);
  return { supabase, projectId: data.project_id as string };
}

export async function getProjectZones(projectId: string): Promise<PhaseZone[]> {
  try {
    await requireProjectAccess(projectId);
    const supabase = await createClient();
    const { data: phases } = await supabase
      .from("visit_phases")
      .select("id")
      .eq("project_id", projectId);

    if (!phases?.length) return [];

    const { data, error } = await supabase
      .from("phase_zones")
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

export async function getPhaseZones(phaseId: string): Promise<PhaseZone[]> {
  const { supabase, projectId } = await getPhaseProjectId(phaseId);
  await requireProjectAccess(projectId);

  const { data, error } = await supabase
    .from("phase_zones")
    .select("*")
    .eq("phase_id", phaseId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addPhaseZone(
  projectId: string,
  phaseId: string,
  name: string
): Promise<PhaseZone> {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Le nom de la zone est obligatoire.");

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("phase_zones")
    .select("sort_order")
    .eq("phase_id", phaseId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("phase_zones")
    .insert({
      phase_id: phaseId,
      name: trimmed,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/controles`);
  return data;
}

export async function deletePhaseZone(projectId: string, zoneId: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const { error } = await supabase.from("phase_zones").delete().eq("id", zoneId);
  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/controles`);
}

export async function findOrCreatePhaseZone(
  phaseId: string,
  zoneName: string
): Promise<PhaseZone> {
  const trimmed = zoneName.trim();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("phase_zones")
    .select("*")
    .eq("phase_id", phaseId)
    .eq("name", trimmed)
    .maybeSingle();

  if (existing) return existing;

  const { data: last } = await supabase
    .from("phase_zones")
    .select("sort_order")
    .eq("phase_id", phaseId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("phase_zones")
    .insert({
      phase_id: phaseId,
      name: trimmed,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

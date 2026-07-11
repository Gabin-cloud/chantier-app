"use server";

import { revalidatePath } from "next/cache";
import { requireProjectAccess, requireProjectRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { VisitPhase } from "@/lib/types/database";

const DEFAULT_PHASES = [
  { name: "Gros œuvre", sort_order: 1 },
  { name: "Second œuvre", sort_order: 2 },
  { name: "Livraison", sort_order: 3 },
];

export async function ensureDefaultPhases(projectId: string): Promise<VisitPhase[]> {
  await requireProjectAccess(projectId);
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("visit_phases")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (existing && existing.length > 0) {
    return existing;
  }

  const { data, error } = await supabase
    .from("visit_phases")
    .insert(DEFAULT_PHASES.map((p) => ({ ...p, project_id: projectId })))
    .select("*");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getProjectPhases(projectId: string): Promise<VisitPhase[]> {
  try {
    return await ensureDefaultPhases(projectId);
  } catch {
    return [];
  }
}

export async function addVisitPhase(projectId: string, name: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Le nom de la phase est obligatoire.");

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("visit_phases")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("visit_phases")
    .insert({
      project_id: projectId,
      name: trimmed,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);

  return data;
}

export async function updateVisitPhase(
  projectId: string,
  phaseId: string,
  name: string
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Le nom de la phase est obligatoire.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("visit_phases")
    .update({ name: trimmed })
    .eq("id", phaseId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
}

export async function deleteVisitPhase(projectId: string, phaseId: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const { count } = await supabase
    .from("visits")
    .select("*", { count: "exact", head: true })
    .eq("phase_id", phaseId);

  if ((count ?? 0) > 0) {
    throw new Error("Impossible de supprimer une phase qui contient des visites.");
  }

  const { error } = await supabase
    .from("visit_phases")
    .delete()
    .eq("id", phaseId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
}

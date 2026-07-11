"use server";

import { revalidatePath } from "next/cache";
import { requireProjectAccess, requireProjectRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { ProjectLocation } from "@/lib/types/database";

export async function getProjectLocations(projectId: string): Promise<ProjectLocation[]> {
  await requireProjectAccess(projectId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("project_locations")
    .select("*")
    .eq("project_id", projectId)
    .order("is_preset", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addPresetLocation(projectId: string, name: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Le nom de la localisation est obligatoire.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_locations")
    .insert({
      project_id: projectId,
      name: trimmed,
      is_preset: true,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);

  return data;
}

export async function addCustomLocation(projectId: string, name: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Le nom de la localisation est obligatoire.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("project_locations")
    .upsert(
      {
        project_id: projectId,
        name: trimmed,
        is_preset: false,
        created_by: user?.id ?? null,
      },
      { onConflict: "project_id,name" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return data;
}

export async function deletePresetLocation(projectId: string, locationId: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("project_locations")
    .delete()
    .eq("id", locationId)
    .eq("project_id", projectId)
    .eq("is_preset", true);

  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
}

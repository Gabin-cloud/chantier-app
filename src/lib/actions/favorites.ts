"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types/database";

export async function getFavoriteProjectIds(): Promise<string[]> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("project_favorites")
    .select("project_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.project_id as string);
}

export async function getFavoriteProjects(): Promise<Project[]> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("project_favorites")
    .select("project_id, created_at, projects(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => row.projects as unknown as Project | null)
    .filter((project): project is Project => Boolean(project));
}

export async function toggleProjectFavorite(projectId: string): Promise<{
  favorited: boolean;
}> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("project_favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  if (existing) {
    const { error } = await supabase
      .from("project_favorites")
      .delete()
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    revalidatePath("/pc");
    revalidatePath("/tablette");
    return { favorited: false };
  }

  const { error } = await supabase.from("project_favorites").insert({
    user_id: user.id,
    project_id: projectId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/pc");
  revalidatePath("/tablette");
  return { favorited: true };
}

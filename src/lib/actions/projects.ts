"use server";

import { revalidatePath } from "next/cache";
import { requireProjectAccess, requireProjectRoles, requireUser } from "@/lib/auth/permissions";
import { importControlLibraryToProject } from "@/lib/actions/control-library";
import { ensureProjectCreatorMember } from "@/lib/actions/members";
import { notifyNewProjectCreated } from "@/lib/notifications/project-created";
import { createClient } from "@/lib/supabase/server";
import type { EnterpriseFormData, ProjectFormData } from "@/lib/types/database";

export async function getProjects() {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function getProject(id: string) {
  await requireProjectAccess(id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*, enterprises(*)")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);

  if (data.enterprises) {
    data.enterprises.sort(
      (a: { created_at: string }, b: { created_at: string }) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  return data;
}

export async function createQuickProject(): Promise<string> {
  try {
    return await createProject({ name: "Nouvelle opération" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible de créer le projet.";
    throw new Error(`Création du projet impossible : ${message}`);
  }
}

export async function createProject(formData: ProjectFormData): Promise<string> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: formData.name.trim() || "Nouvelle opération",
      address: formData.address || null,
      city: formData.city || null,
      postal_code: formData.postal_code || null,
      description: formData.description || null,
      is_operation_configured: false,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(
      error.message.includes("row-level security")
        ? "Droits insuffisants pour créer un projet. Vérifiez votre connexion."
        : error.message
    );
  }

  await ensureProjectCreatorMember(data.id, user.id);

  try {
    await importControlLibraryToProject(data.id);
  } catch (importError) {
    console.error("[createProject] control library import:", importError);
  }

  try {
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    await notifyNewProjectCreated({
      projectId: data.id,
      projectName: formData.name,
      createdByUserId: user.id,
      createdByName: creatorProfile?.full_name ?? null,
      createdByEmail: creatorProfile?.email ?? user.email ?? "",
    });
  } catch (notifyError) {
    console.error("[createProject] notification:", notifyError);
  }

  revalidatePath("/tablette");
  revalidatePath("/pc");
  revalidatePath(`/pc/projets/${data.id}/parametres`);

  return data.id;
}

export async function updateProject(id: string, formData: ProjectFormData) {
  await requireProjectRoles(id, ["admin", "gestionnaire"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      name: formData.name,
      address: formData.address || null,
      city: formData.city || null,
      postal_code: formData.postal_code || null,
      description: formData.description || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${id}`);
  revalidatePath(`/tablette/projets/${id}/parametres`);
  revalidatePath(`/pc/projets/${id}`);
  revalidatePath(`/pc/projets/${id}/parametres`);
  revalidatePath("/tablette");
  revalidatePath("/pc");
}

export async function addEnterprise(projectId: string, formData: EnterpriseFormData) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();
  const { error } = await supabase.from("enterprises").insert({
    project_id: projectId,
    name: formData.name,
    trade: formData.trade || null,
    contact_name: formData.contact_name || null,
    contact_email: formData.contact_email || null,
    contact_phone: formData.contact_phone || null,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
}

export async function deleteEnterprise(projectId: string, enterpriseId: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("enterprises")
    .delete()
    .eq("id", enterpriseId);

  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
}

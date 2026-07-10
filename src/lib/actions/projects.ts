"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { EnterpriseFormData, ProjectFormData } from "@/lib/types/database";

export async function getProjects() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function getProject(id: string) {
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

export async function createProject(formData: ProjectFormData): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: formData.name,
      address: formData.address || null,
      city: formData.city || null,
      postal_code: formData.postal_code || null,
      description: formData.description || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/tablette");
  revalidatePath("/pc");

  return data.id;
}

export async function updateProject(id: string, formData: ProjectFormData) {
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
  const supabase = await createClient();
  const { error } = await supabase
    .from("enterprises")
    .delete()
    .eq("id", enterpriseId);

  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
}

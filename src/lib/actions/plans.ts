"use server";

import { revalidatePath } from "next/cache";
import { requireProjectAccess, requireProjectRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

const PLANS_BUCKET = "plans";

export async function getPlans(projectId: string) {
  await requireProjectAccess(projectId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function getPlanPublicUrl(filePath: string) {
  const supabase = await createClient();
  const { data } = supabase.storage.from(PLANS_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function uploadPlan(projectId: string, formData: FormData) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const file = formData.get("file") as File | null;
  const nameInput = (formData.get("name") as string | null)?.trim();

  if (!file || file.size === 0) {
    throw new Error("Veuillez sélectionner un fichier PDF.");
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Seuls les fichiers PDF sont acceptés.");
  }

  const supabase = await createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${projectId}/${crypto.randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(PLANS_BUCKET)
    .upload(filePath, buffer, { contentType: "application/pdf", upsert: false });

  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from("plans")
    .insert({
      project_id: projectId,
      name: nameInput || file.name.replace(/\.pdf$/i, ""),
      file_path: filePath,
      file_size: file.size,
    })
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from(PLANS_BUCKET).remove([filePath]);
    throw new Error(error.message);
  }

  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);

  return data;
}

export async function deletePlan(projectId: string, planId: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const supabase = await createClient();

  const { data: plan, error: fetchError } = await supabase
    .from("plans")
    .select("file_path")
    .eq("id", planId)
    .eq("project_id", projectId)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const { error } = await supabase.from("plans").delete().eq("id", planId);

  if (error) throw new Error(error.message);

  await supabase.storage.from(PLANS_BUCKET).remove([plan.file_path]);

  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
}

export async function getPlansWithUrls(projectId: string) {
  const plans = await getPlans(projectId);
  const supabase = await createClient();

  return plans.map((plan) => {
    const { data } = supabase.storage.from(PLANS_BUCKET).getPublicUrl(plan.file_path);
    return { ...plan, public_url: data.publicUrl };
  });
}

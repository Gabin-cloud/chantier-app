"use server";

import { revalidatePath } from "next/cache";
import { getProfile, requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

const TEMPLATE_BUCKET = "financial-files";

async function canManageOwnerTemplates(userId: string): Promise<boolean> {
  const profile = await getProfile();
  if (profile.global_role === "super_admin") return true;

  const supabase = await createClient();
  const { data } = await supabase
    .from("project_members")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "gestionnaire"])
    .limit(1);

  return (data?.length ?? 0) > 0;
}

export async function uploadOwnerSituationTemplate(
  ownerId: string,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    if (!(await canManageOwnerTemplates(user.id))) {
      return { ok: false, error: "Droits insuffisants." };
    }

    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) {
      return { ok: false, error: "Fichier Excel manquant." };
    }

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls") && !lower.endsWith(".xlsm")) {
      return { ok: false, error: "Seuls les fichiers Excel (.xlsx, .xls) sont acceptés." };
    }

    const supabase = await createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `owner-templates/${ownerId}/situation-travaux/${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(TEMPLATE_BUCKET)
      .upload(filePath, buffer, {
        contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });

    if (uploadError) return { ok: false, error: uploadError.message };

    const { error: updateError } = await supabase
      .from("owner_directory")
      .update({
        situation_template_path: filePath,
        situation_template_name: file.name,
      })
      .eq("id", ownerId);

    if (updateError) return { ok: false, error: updateError.message };

    revalidatePath(`/pc/referentiels/maitres-ouvrage/${ownerId}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Impossible d'enregistrer le modèle.",
    };
  }
}

export async function removeOwnerSituationTemplate(
  ownerId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    if (!(await canManageOwnerTemplates(user.id))) {
      return { ok: false, error: "Droits insuffisants." };
    }

    const supabase = await createClient();
    const { data: owner } = await supabase
      .from("owner_directory")
      .select("situation_template_path")
      .eq("id", ownerId)
      .maybeSingle();

    if (owner?.situation_template_path) {
      await supabase.storage
        .from(TEMPLATE_BUCKET)
        .remove([owner.situation_template_path]);
    }

    const { error } = await supabase
      .from("owner_directory")
      .update({
        situation_template_path: null,
        situation_template_name: null,
      })
      .eq("id", ownerId);

    if (error) return { ok: false, error: error.message };

    revalidatePath(`/pc/referentiels/maitres-ouvrage/${ownerId}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Impossible de supprimer le modèle.",
    };
  }
}

/** Retrouve le modèle Excel situation de travaux du MOA lié à un projet. */
export async function getOwnerSituationTemplateForProject(projectId: string): Promise<{
  templateName: string | null;
  templateUrl: string | null;
} | null> {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("owner_name, client_name")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) return null;

  const ownerName = (project.owner_name || project.client_name || "").trim();
  if (!ownerName) return null;

  const { data: owner } = await supabase
    .from("owner_directory")
    .select("situation_template_path, situation_template_name")
    .ilike("name", ownerName)
    .maybeSingle();

  if (!owner?.situation_template_path) {
    return { templateName: null, templateUrl: null };
  }

  const { data } = supabase.storage
    .from(TEMPLATE_BUCKET)
    .getPublicUrl(owner.situation_template_path);

  return {
    templateName: owner.situation_template_name,
    templateUrl: data.publicUrl ?? null,
  };
}

export async function getOwnerSituationTemplateUrl(
  templatePath: string
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = supabase.storage.from(TEMPLATE_BUCKET).getPublicUrl(templatePath);
  return data.publicUrl ?? null;
}

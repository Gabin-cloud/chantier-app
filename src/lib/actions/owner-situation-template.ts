"use server";

import { revalidatePath } from "next/cache";
import { getProfile, requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const TEMPLATE_BUCKET = "financial-files";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

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

function buildSituationTemplatePath(ownerId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
  // Même convention que les modèles Word MOA (policies storage Supabase).
  return `${ownerId}/owner-document-templates/situation-travaux/${Date.now()}_${safeName}`;
}

async function getSignedTemplateUrl(filePath: string): Promise<string | null> {
  if (!filePath) return null;

  if (isAdminClientConfigured()) {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(TEMPLATE_BUCKET)
      .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);
    if (!error && data?.signedUrl) return data.signedUrl;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(TEMPLATE_BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
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

    if (file.size > 15 * 1024 * 1024) {
      return { ok: false, error: "Fichier trop volumineux (max 15 Mo)." };
    }

    const filePath = buildSituationTemplatePath(ownerId, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType =
      file.type ||
      (lower.endsWith(".xls")
        ? "application/vnd.ms-excel"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    let uploadErrorMessage: string | null = null;

    if (isAdminClientConfigured()) {
      const admin = createAdminClient();
      const { error: uploadError } = await admin.storage
        .from(TEMPLATE_BUCKET)
        .upload(filePath, buffer, { contentType, upsert: true });

      if (uploadError) uploadErrorMessage = uploadError.message;
    } else {
      const supabase = await createClient();
      const { error: uploadError } = await supabase.storage
        .from(TEMPLATE_BUCKET)
        .upload(filePath, buffer, { contentType, upsert: true });

      if (uploadError) uploadErrorMessage = uploadError.message;
    }

    if (uploadErrorMessage) {
      return { ok: false, error: uploadErrorMessage };
    }

    const supabase = await createClient();
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
      if (isAdminClientConfigured()) {
        const admin = createAdminClient();
        await admin.storage.from(TEMPLATE_BUCKET).remove([owner.situation_template_path]);
      } else {
        await supabase.storage.from(TEMPLATE_BUCKET).remove([owner.situation_template_path]);
      }
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

  const templateUrl = await getSignedTemplateUrl(owner.situation_template_path);

  return {
    templateName: owner.situation_template_name,
    templateUrl,
  };
}

export async function getOwnerSituationTemplateUrl(
  templatePath: string
): Promise<string | null> {
  return getSignedTemplateUrl(templatePath);
}

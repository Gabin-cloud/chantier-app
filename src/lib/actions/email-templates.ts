"use server";

import { revalidatePath } from "next/cache";
import { getProfile, requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { isMeaningfulHtml } from "@/lib/email/html-content";
import {
  DEFAULT_VISIT_EMAIL_BODY,
  DEFAULT_VISIT_EMAIL_SUBJECT,
  VISIT_EMAIL_MERGE_TAGS,
} from "@/lib/notifications/merge-tags";

export type EmailTemplateData = {
  id: string;
  slug: string;
  name: string;
  subjectTemplate: string;
  bodyTemplate: string;
  defaultCc: string;
  updatedAt: string;
};

export type EmailTemplatesSettingsData = {
  canEdit: boolean;
  visitReport: EmailTemplateData;
  mergeTags: typeof VISIT_EMAIL_MERGE_TAGS;
};

async function canManageEmailTemplates(userId: string): Promise<boolean> {
  const profile = await getProfile();
  if (profile.global_role === "super_admin") {
    return true;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "gestionnaire"])
    .limit(1);

  if (error) {
    console.error("[canManageEmailTemplates]", error.message);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

export async function getEmailTemplatesSettings(): Promise<EmailTemplatesSettingsData> {
  const user = await requireUser();
  const canEdit = await canManageEmailTemplates(user.id);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("email_templates")
    .select("id, slug, name, subject_template, body_template, default_cc, updated_at")
    .eq("slug", "visit_report")
    .maybeSingle();

  if (error) {
    const fallback = await supabase
      .from("email_templates")
      .select("id, slug, name, subject_template, body_template, updated_at")
      .eq("slug", "visit_report")
      .maybeSingle();

    if (fallback.error) {
      throw new Error(fallback.error.message);
    }

    const row = fallback.data;
    return {
      canEdit,
      visitReport: row
        ? {
            id: row.id,
            slug: row.slug,
            name: row.name,
            subjectTemplate: row.subject_template,
            bodyTemplate: row.body_template,
            defaultCc: "",
            updatedAt: row.updated_at,
          }
        : {
            id: "default",
            slug: "visit_report",
            name: "Compte-rendu de visite",
            subjectTemplate: DEFAULT_VISIT_EMAIL_SUBJECT,
            bodyTemplate: DEFAULT_VISIT_EMAIL_BODY,
            defaultCc: "",
            updatedAt: new Date().toISOString(),
          },
      mergeTags: VISIT_EMAIL_MERGE_TAGS,
    };
  }

  const visitReport: EmailTemplateData = data
    ? {
        id: data.id,
        slug: data.slug,
        name: data.name,
        subjectTemplate: data.subject_template,
        bodyTemplate: data.body_template,
        defaultCc: data.default_cc ?? "",
        updatedAt: data.updated_at,
      }
    : {
        id: "default",
        slug: "visit_report",
        name: "Compte-rendu de visite",
        subjectTemplate: DEFAULT_VISIT_EMAIL_SUBJECT,
        bodyTemplate: DEFAULT_VISIT_EMAIL_BODY,
        defaultCc: "",
        updatedAt: new Date().toISOString(),
      };

  return {
    canEdit,
    visitReport,
    mergeTags: VISIT_EMAIL_MERGE_TAGS,
  };
}

export async function getVisitReportEmailTemplate(): Promise<{
  subjectTemplate: string;
  bodyTemplate: string;
  defaultCc: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("subject_template, body_template, default_cc")
    .eq("slug", "visit_report")
    .maybeSingle();

  if (error || !data) {
    const fallback = await supabase
      .from("email_templates")
      .select("subject_template, body_template")
      .eq("slug", "visit_report")
      .maybeSingle();

    if (fallback.error || !fallback.data) {
      return {
        subjectTemplate: DEFAULT_VISIT_EMAIL_SUBJECT,
        bodyTemplate: DEFAULT_VISIT_EMAIL_BODY,
        defaultCc: "",
      };
    }

    return {
      subjectTemplate: fallback.data.subject_template,
      bodyTemplate: fallback.data.body_template,
      defaultCc: "",
    };
  }

  return {
    subjectTemplate: data.subject_template,
    bodyTemplate: data.body_template,
    defaultCc: data.default_cc ?? "",
  };
}

export async function updateVisitReportEmailTemplate(input: {
  subjectTemplate: string;
  bodyTemplate: string;
  defaultCc?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const allowed = await canManageEmailTemplates(user.id);
    if (!allowed) {
      return {
        ok: false,
        error:
          "Droits insuffisants. Seuls les administrateurs ou gestionnaires peuvent modifier le mail type.",
      };
    }

    const supabase = await createClient();
    const subjectTemplate = input.subjectTemplate.trim();
    const bodyTemplate = input.bodyTemplate.trim();
    const defaultCc = input.defaultCc?.trim() ?? "";

    if (!subjectTemplate) {
      return { ok: false, error: "L'objet du mail est obligatoire." };
    }

    if (!isMeaningfulHtml(bodyTemplate)) {
      return { ok: false, error: "Le corps du mail est obligatoire." };
    }

    const row = {
      slug: "visit_report",
      name: "Compte-rendu de visite",
      subject_template: subjectTemplate,
      body_template: bodyTemplate,
      default_cc: defaultCc || null,
      updated_by: user.id,
    };

    const { data: existing } = await supabase
      .from("email_templates")
      .select("id")
      .eq("slug", "visit_report")
      .maybeSingle();

    const { error } = existing
      ? await supabase.from("email_templates").update(row).eq("slug", "visit_report")
      : await supabase.from("email_templates").insert(row);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/pc/parametres");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Impossible d'enregistrer le modèle.",
    };
  }
}

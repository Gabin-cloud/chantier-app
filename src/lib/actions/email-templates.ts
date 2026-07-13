"use server";

import { revalidatePath } from "next/cache";
import { getProfile, requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
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

async function requireTemplateEditor() {
  const profile = await getProfile();
  if (profile.global_role !== "super_admin") {
    throw new Error("Seul un super administrateur peut modifier les mails type.");
  }
  return profile;
}

export async function getEmailTemplatesSettings(): Promise<EmailTemplatesSettingsData> {
  await requireUser();
  const profile = await getProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("email_templates")
    .select("id, slug, name, subject_template, body_template, default_cc, updated_at")
    .eq("slug", "visit_report")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
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
    canEdit: profile.global_role === "super_admin",
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
    return {
      subjectTemplate: DEFAULT_VISIT_EMAIL_SUBJECT,
      bodyTemplate: DEFAULT_VISIT_EMAIL_BODY,
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
    await requireTemplateEditor();
    const user = await requireUser();
    const supabase = await createClient();

    const subjectTemplate = input.subjectTemplate.trim();
    const bodyTemplate = input.bodyTemplate.trim();
    const defaultCc = input.defaultCc?.trim() ?? "";

    if (!subjectTemplate || !bodyTemplate) {
      return { ok: false, error: "L'objet et le corps du mail sont obligatoires." };
    }

    const { error } = await supabase.from("email_templates").upsert(
      {
        slug: "visit_report",
        name: "Compte-rendu de visite",
        subject_template: subjectTemplate,
        body_template: bodyTemplate,
        default_cc: defaultCc || null,
        updated_by: user.id,
      },
      { onConflict: "slug" }
    );

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

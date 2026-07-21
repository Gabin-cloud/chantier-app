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
import {
  DEFAULT_INVITATION_BODY,
  DEFAULT_INVITATION_SUBJECT,
  INVITATION_EMAIL_MERGE_TAGS,
} from "@/lib/notifications/invitation-email";
import {
  AMENDMENT_EMAIL_MERGE_TAGS,
  DEFAULT_AMENDMENT_EMAIL_BODY,
  DEFAULT_AMENDMENT_EMAIL_SUBJECT,
} from "@/lib/notifications/amendment-email";
import {
  DEVIS_MOU_EMAIL_MERGE_TAGS,
  DEFAULT_DEVIS_MOU_EMAIL_BODY,
  DEFAULT_DEVIS_MOU_EMAIL_SUBJECT,
} from "@/lib/notifications/devis-mou-email";
import {
  TMA_ENTREPRISE_EMAIL_MERGE_TAGS,
  DEFAULT_TMA_ENTREPRISE_EMAIL_BODY,
  DEFAULT_TMA_ENTREPRISE_EMAIL_SUBJECT,
} from "@/lib/notifications/tma-entreprise-email";

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
  platformInvitation: EmailTemplateData;
  amendmentSend: EmailTemplateData;
  devisMouSend: EmailTemplateData;
  mergeTags: typeof VISIT_EMAIL_MERGE_TAGS;
  invitationMergeTags: typeof INVITATION_EMAIL_MERGE_TAGS;
  amendmentMergeTags: typeof AMENDMENT_EMAIL_MERGE_TAGS;
  devisMouMergeTags: typeof DEVIS_MOU_EMAIL_MERGE_TAGS;
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

function mapTemplateRow(
  row: {
    id: string;
    slug: string;
    name: string;
    subject_template: string;
    body_template: string;
    default_cc?: string | null;
    updated_at: string;
  } | null,
  fallback: EmailTemplateData
): EmailTemplateData {
  if (!row) return fallback;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    subjectTemplate: row.subject_template,
    bodyTemplate: row.body_template,
    defaultCc: row.default_cc ?? "",
    updatedAt: row.updated_at,
  };
}

export async function getEmailTemplatesSettings(): Promise<EmailTemplatesSettingsData> {
  const user = await requireUser();
  const canEdit = await canManageEmailTemplates(user.id);
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("email_templates")
    .select("id, slug, name, subject_template, body_template, default_cc, updated_at")
    .in("slug", ["visit_report", "platform_invitation", "amendment_send", "devis_mou_send"]);

  if (error) throw new Error(error.message);

  const visitRow = rows?.find((r) => r.slug === "visit_report") ?? null;
  const inviteRow = rows?.find((r) => r.slug === "platform_invitation") ?? null;
  const amendmentRow = rows?.find((r) => r.slug === "amendment_send") ?? null;
  const devisMouRow = rows?.find((r) => r.slug === "devis_mou_send") ?? null;

  return {
    canEdit,
    visitReport: mapTemplateRow(visitRow, {
      id: "default",
      slug: "visit_report",
      name: "Compte-rendu de visite",
      subjectTemplate: DEFAULT_VISIT_EMAIL_SUBJECT,
      bodyTemplate: DEFAULT_VISIT_EMAIL_BODY,
      defaultCc: "",
      updatedAt: new Date().toISOString(),
    }),
    platformInvitation: mapTemplateRow(inviteRow, {
      id: "default",
      slug: "platform_invitation",
      name: "Invitation plateforme",
      subjectTemplate: DEFAULT_INVITATION_SUBJECT,
      bodyTemplate: DEFAULT_INVITATION_BODY,
      defaultCc: "",
      updatedAt: new Date().toISOString(),
    }),
    amendmentSend: mapTemplateRow(amendmentRow, {
      id: "default",
      slug: "amendment_send",
      name: "Envoi avenant entreprise",
      subjectTemplate: DEFAULT_AMENDMENT_EMAIL_SUBJECT,
      bodyTemplate: DEFAULT_AMENDMENT_EMAIL_BODY,
      defaultCc: "",
      updatedAt: new Date().toISOString(),
    }),
    devisMouSend: mapTemplateRow(devisMouRow, {
      id: "default",
      slug: "devis_mou_send",
      name: "Envoi devis au maître d'ouvrage",
      subjectTemplate: DEFAULT_DEVIS_MOU_EMAIL_SUBJECT,
      bodyTemplate: DEFAULT_DEVIS_MOU_EMAIL_BODY,
      defaultCc: "",
      updatedAt: new Date().toISOString(),
    }),
    mergeTags: VISIT_EMAIL_MERGE_TAGS,
    invitationMergeTags: INVITATION_EMAIL_MERGE_TAGS,
    amendmentMergeTags: AMENDMENT_EMAIL_MERGE_TAGS,
    devisMouMergeTags: DEVIS_MOU_EMAIL_MERGE_TAGS,
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

export async function getAmendmentEmailTemplate(): Promise<{
  subjectTemplate: string;
  bodyTemplate: string;
  defaultCc: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("subject_template, body_template, default_cc")
    .eq("slug", "amendment_send")
    .maybeSingle();

  if (error || !data) {
    return {
      subjectTemplate: DEFAULT_AMENDMENT_EMAIL_SUBJECT,
      bodyTemplate: DEFAULT_AMENDMENT_EMAIL_BODY,
      defaultCc: "",
    };
  }

  return {
    subjectTemplate: data.subject_template,
    bodyTemplate: data.body_template,
    defaultCc: data.default_cc ?? "",
  };
}

export async function updateAmendmentEmailTemplate(input: {
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
        error: "Droits insuffisants pour modifier le mail type.",
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
      slug: "amendment_send",
      name: "Envoi avenant entreprise",
      subject_template: subjectTemplate,
      body_template: bodyTemplate,
      default_cc: defaultCc || null,
      updated_by: user.id,
    };

    const { data: existing } = await supabase
      .from("email_templates")
      .select("id")
      .eq("slug", "amendment_send")
      .maybeSingle();

    const { error } = existing
      ? await supabase.from("email_templates").update(row).eq("slug", "amendment_send")
      : await supabase.from("email_templates").insert(row);

    if (error) return { ok: false, error: error.message };

    revalidatePath("/pc/parametres");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Impossible d'enregistrer le modèle.",
    };
  }
}

export async function getDevisMouEmailTemplate(): Promise<{
  subjectTemplate: string;
  bodyTemplate: string;
  defaultCc: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("subject_template, body_template, default_cc")
    .eq("slug", "devis_mou_send")
    .maybeSingle();

  if (error || !data) {
    return {
      subjectTemplate: DEFAULT_DEVIS_MOU_EMAIL_SUBJECT,
      bodyTemplate: DEFAULT_DEVIS_MOU_EMAIL_BODY,
      defaultCc: "",
    };
  }

  return {
    subjectTemplate: data.subject_template,
    bodyTemplate: data.body_template,
    defaultCc: data.default_cc ?? "",
  };
}

export async function updateDevisMouEmailTemplate(input: {
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
        error: "Droits insuffisants pour modifier le mail type.",
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
      slug: "devis_mou_send",
      name: "Envoi devis au maître d'ouvrage",
      subject_template: subjectTemplate,
      body_template: bodyTemplate,
      default_cc: defaultCc || null,
      updated_by: user.id,
    };

    const { data: existing } = await supabase
      .from("email_templates")
      .select("id")
      .eq("slug", "devis_mou_send")
      .maybeSingle();

    const { error } = existing
      ? await supabase.from("email_templates").update(row).eq("slug", "devis_mou_send")
      : await supabase.from("email_templates").insert(row);

    if (error) return { ok: false, error: error.message };

    revalidatePath("/pc/parametres");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Impossible d'enregistrer le modèle.",
    };
  }
}

export async function getTmaEntrepriseEmailTemplate(): Promise<{
  subjectTemplate: string;
  bodyTemplate: string;
  defaultCc: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("subject_template, body_template, default_cc")
    .eq("slug", "tma_entreprise_send")
    .maybeSingle();

  if (error || !data) {
    return {
      subjectTemplate: DEFAULT_TMA_ENTREPRISE_EMAIL_SUBJECT,
      bodyTemplate: DEFAULT_TMA_ENTREPRISE_EMAIL_BODY,
      defaultCc: "",
    };
  }

  return {
    subjectTemplate: data.subject_template,
    bodyTemplate: data.body_template,
    defaultCc: data.default_cc ?? "",
  };
}

export async function updateTmaEntrepriseEmailTemplate(input: {
  subjectTemplate: string;
  bodyTemplate: string;
  defaultCc?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const allowed = await canManageEmailTemplates(user.id);
    if (!allowed) {
      return { ok: false, error: "Droits insuffisants pour modifier le mail type." };
    }

    const supabase = await createClient();
    const subjectTemplate = input.subjectTemplate.trim();
    const bodyTemplate = input.bodyTemplate.trim();
    const defaultCc = input.defaultCc?.trim() ?? "";

    if (!subjectTemplate) return { ok: false, error: "L'objet du mail est obligatoire." };
    if (!isMeaningfulHtml(bodyTemplate)) {
      return { ok: false, error: "Le corps du mail est obligatoire." };
    }

    const row = {
      slug: "tma_entreprise_send",
      name: "Envoi TMA aux entreprises",
      subject_template: subjectTemplate,
      body_template: bodyTemplate,
      default_cc: defaultCc || null,
      updated_by: user.id,
    };

    const { data: existing } = await supabase
      .from("email_templates")
      .select("id")
      .eq("slug", "tma_entreprise_send")
      .maybeSingle();

    const { error } = existing
      ? await supabase.from("email_templates").update(row).eq("slug", "tma_entreprise_send")
      : await supabase.from("email_templates").insert(row);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/pc/parametres");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Impossible d'enregistrer le modèle.",
    };
  }
}

export async function getPlatformInvitationEmailTemplate(): Promise<{
  subjectTemplate: string;
  bodyTemplate: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("subject_template, body_template")
    .eq("slug", "platform_invitation")
    .maybeSingle();

  if (error || !data) {
    return {
      subjectTemplate: DEFAULT_INVITATION_SUBJECT,
      bodyTemplate: DEFAULT_INVITATION_BODY,
    };
  }

  return {
    subjectTemplate: data.subject_template,
    bodyTemplate: data.body_template,
  };
}

export async function updatePlatformInvitationEmailTemplate(input: {
  subjectTemplate: string;
  bodyTemplate: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const allowed = await canManageEmailTemplates(user.id);
    if (!allowed) {
      return {
        ok: false,
        error: "Droits insuffisants pour modifier le mail type.",
      };
    }

    const supabase = await createClient();
    const subjectTemplate = input.subjectTemplate.trim();
    const bodyTemplate = input.bodyTemplate.trim();

    if (!subjectTemplate) {
      return { ok: false, error: "L'objet du mail est obligatoire." };
    }
    if (!isMeaningfulHtml(bodyTemplate)) {
      return { ok: false, error: "Le corps du mail est obligatoire." };
    }

    const row = {
      slug: "platform_invitation",
      name: "Invitation plateforme",
      subject_template: subjectTemplate,
      body_template: bodyTemplate,
      updated_by: user.id,
    };

    const { data: existing } = await supabase
      .from("email_templates")
      .select("id")
      .eq("slug", "platform_invitation")
      .maybeSingle();

    const { error } = existing
      ? await supabase.from("email_templates").update(row).eq("slug", "platform_invitation")
      : await supabase.from("email_templates").insert(row);

    if (error) return { ok: false, error: error.message };

    revalidatePath("/pc/parametres");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Impossible d'enregistrer le modèle.",
    };
  }
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

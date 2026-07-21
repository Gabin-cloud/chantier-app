"use server";

import { revalidatePath } from "next/cache";
import { getTmaEntrepriseEmailTemplate } from "@/lib/actions/email-templates";
import { requireUser } from "@/lib/auth/permissions";
import { requireFinanceAccess } from "@/lib/actions/members";
import { getM365DraftReadiness } from "@/lib/actions/control-board";
import { createUserMailDraft, sendUserMail, type MailAttachment } from "@/lib/microsoft/graph";
import {
  normalizeRecipients,
  parseEmailList,
  validateEmailRecipients,
} from "@/lib/email/recipients";
import { buildTmaEntrepriseEmailFromTemplates } from "@/lib/notifications/tma-entreprise-email";
import { createClient } from "@/lib/supabase/server";

const FINANCIAL_BUCKET = "financial-files";

export type TmaEmailPreviewResult =
  | {
      ok: true;
      subject: string;
      htmlBody: string;
      recipients: { email: string; name: string }[];
      skipped: string[];
      defaultCc: string;
    }
  | { ok: false; error: string };

export type TmaEmailOverrides = {
  subject?: string;
  htmlBody?: string;
  recipients?: { email: string; name?: string | null }[];
  cc?: string;
};

async function assembleTmaEmail(projectId: string, dossierId: string) {
  await requireFinanceAccess(projectId);
  const supabase = await createClient();

  const { data: dossier, error: dossierError } = await supabase
    .from("work_tma_dossiers")
    .select("*")
    .eq("id", dossierId)
    .eq("project_id", projectId)
    .single();

  if (dossierError || !dossier) {
    return { ok: false as const, error: "Dossier TMA introuvable." };
  }

  const { data: entries } = await supabase
    .from("work_tma_entries")
    .select("enterprise_id, enterprise_name")
    .eq("dossier_id", dossierId);

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .single();

  const enterpriseIds = Array.from(
    new Set((entries ?? []).map((e) => e.enterprise_id).filter(Boolean))
  ) as string[];

  const recipients: { email: string; name: string }[] = [];
  const skipped: string[] = [];

  if (enterpriseIds.length) {
    const { data: enterprises } = await supabase
      .from("enterprises")
      .select("id, name, email_travaux, contact_email")
      .in("id", enterpriseIds);

    for (const ent of enterprises ?? []) {
      const email = ent.email_travaux || ent.contact_email;
      if (email) {
        recipients.push({ email, name: ent.name });
      } else {
        skipped.push(ent.name);
      }
    }
  }

  const template = await getTmaEntrepriseEmailTemplate();
  const { subject, htmlBody } = buildTmaEntrepriseEmailFromTemplates(
    template.subjectTemplate,
    template.bodyTemplate,
    {
      projectName: project?.name ?? "",
      logementNumber: dossier.logement_number,
      enterpriseNames: (entries ?? []).map((e) => e.enterprise_name),
      lineCount: entries?.length ?? 0,
    }
  );

  return {
    ok: true as const,
    data: {
      subject,
      htmlBody,
      recipients,
      skipped,
      defaultCc: template.defaultCc,
      dossier,
    },
  };
}

export async function prepareTmaEmailPreview(
  projectId: string,
  dossierId: string
): Promise<TmaEmailPreviewResult> {
  try {
    const assembled = await assembleTmaEmail(projectId, dossierId);
    if (!assembled.ok) return assembled;

    return {
      ok: true,
      subject: assembled.data.subject,
      htmlBody: assembled.data.htmlBody,
      recipients: assembled.data.recipients,
      skipped: assembled.data.skipped,
      defaultCc: assembled.data.defaultCc,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Impossible de préparer le mail.",
    };
  }
}

export async function createTmaEmailDraft(
  projectId: string,
  dossierId: string,
  overrides?: TmaEmailOverrides
) {
  try {
    const m365 = await getM365DraftReadiness();
    if (!m365.ready) {
      return { ok: false as const, error: m365.message ?? "Microsoft 365 non connecté." };
    }

    const assembled = await assembleTmaEmail(projectId, dossierId);
    if (!assembled.ok) return assembled;

    const subject = overrides?.subject?.trim() || assembled.data.subject;
    const htmlBody = overrides?.htmlBody?.trim() || assembled.data.htmlBody;
    const recipients = overrides?.recipients
      ? normalizeRecipients(overrides.recipients)
      : assembled.data.recipients;

    const toError = validateEmailRecipients(recipients, "destinataire");
    if (toError) return { ok: false as const, error: toError };

    const supabase = await createClient();
    const mouPaths = (assembled.data.dossier.mou_document_paths ?? []) as string[];
    const attachments: MailAttachment[] = [];

    for (const path of mouPaths) {
      const { data: blob } = await supabase.storage.from(FINANCIAL_BUCKET).download(path);
      if (!blob) continue;
      const bytes = Buffer.from(await blob.arrayBuffer()).toString("base64");
      attachments.push({
        name: path.split("/").pop() ?? "document.pdf",
        contentBytes: bytes,
        contentType: "application/pdf",
      });
    }

    const user = await requireUser();
    const draft = await createUserMailDraft(user.id, {
      subject,
      htmlBody,
      to: recipients,
      cc: parseEmailList(overrides?.cc ?? assembled.data.defaultCc),
      attachments,
    });

    revalidatePath(`/pc/projets/${projectId}/suivi-travaux/tma`);
    return { ok: true as const, webLink: draft.webLink, subject, recipients: recipients.map((r) => r.email) };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Impossible de créer le brouillon.",
    };
  }
}

export async function sendTmaEmail(
  projectId: string,
  dossierId: string,
  overrides?: TmaEmailOverrides
) {
  try {
    const m365 = await getM365DraftReadiness();
    if (!m365.ready) {
      return { ok: false as const, error: m365.message ?? "Microsoft 365 non connecté." };
    }

    const assembled = await assembleTmaEmail(projectId, dossierId);
    if (!assembled.ok) return assembled;

    const subject = overrides?.subject?.trim() || assembled.data.subject;
    const htmlBody = overrides?.htmlBody?.trim() || assembled.data.htmlBody;
    const recipients = overrides?.recipients
      ? normalizeRecipients(overrides.recipients)
      : assembled.data.recipients;

    const toError = validateEmailRecipients(recipients, "destinataire");
    if (toError) return { ok: false as const, error: toError };

    const user = await requireUser();
    await sendUserMail(user.id, {
      subject,
      htmlBody,
      to: recipients,
      cc: parseEmailList(overrides?.cc ?? assembled.data.defaultCc),
    });

    revalidatePath(`/pc/projets/${projectId}/suivi-travaux/tma`);
    return { ok: true as const, subject, recipients: recipients.map((r) => r.email) };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Impossible d'envoyer le mail.",
    };
  }
}

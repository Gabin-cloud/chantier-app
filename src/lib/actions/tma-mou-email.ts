"use server";

import { revalidatePath } from "next/cache";
import { getTmaMouEmailTemplate } from "@/lib/actions/email-templates";
import { requireFinanceAccess } from "@/lib/actions/members";
import { getM365DraftReadiness } from "@/lib/actions/control-board";
import { createUserMailDraft, sendUserMail } from "@/lib/microsoft/graph";
import {
  normalizeRecipients,
  parseEmailList,
  validateEmailRecipients,
} from "@/lib/email/recipients";
import { requireUser } from "@/lib/auth/permissions";
import { buildTmaMouEmailFromTemplates } from "@/lib/notifications/tma-mou-email";
import { createClient } from "@/lib/supabase/server";

const FINANCIAL_BUCKET = "financial-files";

export type TmaMouEmailPreviewResult =
  | {
      ok: true;
      subject: string;
      htmlBody: string;
      recipients: { email: string; name: string }[];
      skipped: string[];
      attachments: { fileName: string; pdfUrl: string | null }[];
      defaultCc: string;
    }
  | { ok: false; error: string };

export type TmaMouEmailOverrides = {
  subject?: string;
  htmlBody?: string;
  recipients?: { email: string; name?: string | null }[];
  cc?: string;
};

type QuoteAttachment = {
  fileName: string;
  pdfBase64: string;
  pdfUrl: string | null;
};

function sanitizeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
}

function buildTmaDepositFileName(input: {
  logementNumber: string;
  enterpriseName: string;
  devisNumber: string;
  originalName?: string | null;
}): string {
  const ext = input.originalName?.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? ".pdf";
  const date = new Date().toISOString().slice(0, 10);
  return [
    "TMA",
    sanitizeFilePart(input.logementNumber || "logement"),
    sanitizeFilePart(input.enterpriseName || "entreprise"),
    sanitizeFilePart(input.devisNumber || date),
  ].join("_") + ext;
}

async function assembleTmaMouEmail(
  projectId: string,
  entryIds: string[]
): Promise<
  | {
      ok: true;
      data: {
        subject: string;
        htmlBody: string;
        recipients: { email: string; name: string }[];
        skipped: string[];
        attachments: QuoteAttachment[];
        defaultCc: string;
        entryIds: string[];
      };
    }
  | { ok: false; error: string }
> {
  if (!entryIds.length) {
    return { ok: false, error: "Sélectionnez au moins un dépôt analysé." };
  }

  await requireFinanceAccess(projectId);
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "name, client_name, owner_name, owner_email_admin, owner_email_works, owner_signatory_name, owner_signatory_email"
    )
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return { ok: false, error: "Projet introuvable." };
  }

  const { data: entries, error: entriesError } = await supabase
    .from("work_tma_entries")
    .select(
      `id, logement_number, montant_ht, devis_number, deposit_file_path, deposit_file_name,
      enterprise:enterprises(name)`
    )
    .eq("project_id", projectId)
    .in("id", entryIds)
    .eq("status", "analyzed");

  if (entriesError || !entries?.length) {
    return { ok: false, error: "Aucun dépôt analysé sélectionné." };
  }

  const seenPaths = new Set<string>();
  const attachments: QuoteAttachment[] = [];
  const skipped: string[] = [];
  const logementNumbers: string[] = [];
  let totalHt = 0;

  for (const entry of entries) {
    totalHt += Number(entry.montant_ht);
    if (entry.logement_number) logementNumbers.push(entry.logement_number);

    const filePath = entry.deposit_file_path;
    if (!filePath || seenPaths.has(filePath)) continue;
    seenPaths.add(filePath);

    const enterpriseRaw = entry.enterprise as unknown;
    const enterprise = (Array.isArray(enterpriseRaw) ? enterpriseRaw[0] : enterpriseRaw) as
      | { name: string }
      | null
      | undefined;

    const { data: pdfFile, error: downloadError } = await supabase.storage
      .from(FINANCIAL_BUCKET)
      .download(filePath);

    if (downloadError || !pdfFile) {
      skipped.push(
        `${enterprise?.name ?? "Entreprise"} ${entry.devis_number || ""}`.trim() +
          " : impossible de télécharger le PDF"
      );
      continue;
    }

    const pdfBase64 = Buffer.from(await pdfFile.arrayBuffer()).toString("base64");
    const { data: publicUrlData } = supabase.storage
      .from(FINANCIAL_BUCKET)
      .getPublicUrl(filePath);

    attachments.push({
      fileName: buildTmaDepositFileName({
        logementNumber: entry.logement_number,
        enterpriseName: enterprise?.name ?? "",
        devisNumber: entry.devis_number,
        originalName: entry.deposit_file_name,
      }),
      pdfBase64,
      pdfUrl: publicUrlData.publicUrl ?? null,
    });
  }

  if (!attachments.length) {
    return {
      ok: false,
      error: `Aucun PDF disponible. ${skipped.join(" · ")}`,
    };
  }

  const emailTemplate = await getTmaMouEmailTemplate();
  const emailContent = buildTmaMouEmailFromTemplates(
    emailTemplate.subjectTemplate,
    emailTemplate.bodyTemplate,
    {
      projectName: project.name,
      logementNumbers,
      depositCount: attachments.length,
      totalHt,
    }
  );

  const ownerEmail =
    project.owner_email_works ||
    project.owner_email_admin ||
    project.owner_signatory_email;
  const ownerName =
    project.owner_signatory_name || project.client_name || project.owner_name || "Maître d'ouvrage";

  const recipients: { email: string; name: string }[] = [];
  if (ownerEmail) {
    recipients.push({ email: ownerEmail, name: ownerName });
  } else {
    skipped.push("Maître d'ouvrage : pas d'e-mail renseigné sur la fiche opération");
  }

  if (!recipients.length) {
    return {
      ok: false,
      error: `Aucun destinataire avec e-mail. ${skipped.join(" · ")}`,
    };
  }

  return {
    ok: true,
    data: {
      subject: emailContent.subject,
      htmlBody: emailContent.htmlBody,
      recipients,
      skipped,
      attachments,
      defaultCc: emailTemplate.defaultCc,
      entryIds: entries.map((e) => e.id),
    },
  };
}

export async function prepareTmaMouEmailPreview(
  projectId: string,
  entryIds: string[]
): Promise<TmaMouEmailPreviewResult> {
  try {
    const assembled = await assembleTmaMouEmail(projectId, entryIds);
    if (!assembled.ok) return assembled;

    const { subject, htmlBody, recipients, skipped, attachments, defaultCc } = assembled.data;
    return {
      ok: true,
      subject,
      htmlBody,
      recipients,
      skipped,
      attachments: attachments.map((a) => ({ fileName: a.fileName, pdfUrl: a.pdfUrl })),
      defaultCc,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Impossible de préparer le mail.",
    };
  }
}

export async function createTmaMouEmailDraft(
  projectId: string,
  entryIds: string[],
  overrides?: TmaMouEmailOverrides
) {
  try {
    const m365 = await getM365DraftReadiness();
    if (!m365.ready) {
      return { ok: false as const, error: m365.message ?? "Microsoft 365 non connecté." };
    }

    const user = await requireUser();
    const assembled = await assembleTmaMouEmail(projectId, entryIds);
    if (!assembled.ok) return assembled;

    const subject = overrides?.subject?.trim() || assembled.data.subject;
    const htmlBody = overrides?.htmlBody?.trim() || assembled.data.htmlBody;
    const recipients = overrides?.recipients
      ? normalizeRecipients(overrides.recipients)
      : assembled.data.recipients;

    const toError = validateEmailRecipients(recipients, "destinataire");
    if (toError) return { ok: false as const, error: toError };

    const draft = await createUserMailDraft(user.id, {
      subject,
      htmlBody,
      to: recipients,
      cc: parseEmailList(overrides?.cc ?? assembled.data.defaultCc),
      attachments: assembled.data.attachments.map((a) => ({
        name: a.fileName,
        contentType: "application/pdf",
        contentBytes: a.pdfBase64,
      })),
    });

    const { markTmaSentToMou } = await import("@/lib/actions/tma");
    await markTmaSentToMou(projectId, assembled.data.entryIds);

    revalidatePath(`/pc/projets/${projectId}/suivi-travaux/tma`);
    return {
      ok: true as const,
      webLink: draft.webLink,
      subject,
      recipients: recipients.map((r) => r.email),
      skipped: assembled.data.skipped,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Impossible de créer le brouillon.",
    };
  }
}

export async function sendTmaMouEmail(
  projectId: string,
  entryIds: string[],
  overrides?: TmaMouEmailOverrides
) {
  try {
    const m365 = await getM365DraftReadiness();
    if (!m365.ready) {
      return { ok: false as const, error: m365.message ?? "Microsoft 365 non connecté." };
    }

    const user = await requireUser();
    const assembled = await assembleTmaMouEmail(projectId, entryIds);
    if (!assembled.ok) return assembled;

    const subject = overrides?.subject?.trim() || assembled.data.subject;
    const htmlBody = overrides?.htmlBody?.trim() || assembled.data.htmlBody;
    const recipients = overrides?.recipients
      ? normalizeRecipients(overrides.recipients)
      : assembled.data.recipients;

    const toError = validateEmailRecipients(recipients, "destinataire");
    if (toError) return { ok: false as const, error: toError };

    await sendUserMail(user.id, {
      subject,
      htmlBody,
      to: recipients,
      cc: parseEmailList(overrides?.cc ?? assembled.data.defaultCc),
      attachments: assembled.data.attachments.map((a) => ({
        name: a.fileName,
        contentType: "application/pdf",
        contentBytes: a.pdfBase64,
      })),
    });

    const { markTmaSentToMou } = await import("@/lib/actions/tma");
    await markTmaSentToMou(projectId, assembled.data.entryIds);

    revalidatePath(`/pc/projets/${projectId}/suivi-travaux/tma`);
    return {
      ok: true as const,
      subject,
      recipients: recipients.map((r) => r.email),
      skipped: assembled.data.skipped,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Impossible d'envoyer le mail.",
    };
  }
}

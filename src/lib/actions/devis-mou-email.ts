"use server";

import { revalidatePath } from "next/cache";
import { getDevisMouEmailTemplate } from "@/lib/actions/email-templates";
import { requireFinanceAccess } from "@/lib/actions/members";
import { getM365DraftReadiness } from "@/lib/actions/control-board";
import { createUserMailDraft, sendUserMail } from "@/lib/microsoft/graph";
import {
  normalizeRecipients,
  parseEmailList,
  validateEmailRecipients,
} from "@/lib/email/recipients";
import { requireUser } from "@/lib/auth/permissions";
import { buildDevisMouEmailFromTemplates } from "@/lib/notifications/devis-mou-email";
import { createClient } from "@/lib/supabase/server";

const FINANCIAL_BUCKET = "financial-files";

export type DevisMouEmailPreviewResult =
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

export type DevisMouEmailOverrides = {
  subject?: string;
  htmlBody?: string;
  recipients?: { email: string; name?: string | null }[];
  cc?: string;
};

export type DevisMouPrepareDraftResult =
  | {
      ok: true;
      webLink: string | null;
      subject: string;
      recipients: string[];
      skipped: string[];
    }
  | { ok: false; error: string };

export type DevisMouSendEmailResult =
  | { ok: true; subject: string; recipients: string[]; skipped: string[] }
  | { ok: false; error: string };

type QuoteAttachment = {
  fileName: string;
  pdfBase64: string;
  pdfUrl: string | null;
};

type AssembledDevisMouEmail = {
  subject: string;
  htmlBody: string;
  recipients: { email: string; name: string }[];
  skipped: string[];
  attachments: QuoteAttachment[];
  defaultCc: string;
  quoteIds: string[];
};

function resolveDevisMouEmailPayload(
  assembled: AssembledDevisMouEmail,
  overrides?: DevisMouEmailOverrides
):
  | {
      ok: true;
      data: {
        subject: string;
        htmlBody: string;
        recipients: { email: string; name: string }[];
        cc: { email: string; name: string }[];
      };
    }
  | { ok: false; error: string } {
  const subject = overrides?.subject?.trim() || assembled.subject;
  const htmlBody = overrides?.htmlBody?.trim() || assembled.htmlBody;
  const recipients = overrides?.recipients
    ? normalizeRecipients(overrides.recipients)
    : assembled.recipients;
  const ccRaw = overrides?.cc ?? assembled.defaultCc;

  if (!subject) {
    return { ok: false, error: "L'objet du mail est obligatoire." };
  }

  const toError = validateEmailRecipients(recipients, "destinataire");
  if (toError) {
    return { ok: false, error: toError };
  }

  if (!htmlBody) {
    return { ok: false, error: "Le corps du mail est obligatoire." };
  }

  const cc = parseEmailList(ccRaw);
  const ccError = cc.length ? validateEmailRecipients(cc, "destinataire en copie") : null;
  if (ccError) {
    return { ok: false, error: ccError };
  }

  return { ok: true, data: { subject, htmlBody, recipients, cc } };
}

async function assembleDevisMouEmail(
  projectId: string,
  quoteIds: string[]
): Promise<{ ok: true; data: AssembledDevisMouEmail } | { ok: false; error: string }> {
  if (!quoteIds.length) {
    return { ok: false, error: "Sélectionnez au moins un devis." };
  }

  await requireFinanceAccess(projectId);
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("name, client_name, owner_name, owner_email_admin, owner_email_works, owner_signatory_name, owner_signatory_email")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return { ok: false, error: "Projet introuvable." };
  }

  const { data: quotes, error: quotesError } = await supabase
    .from("financial_quotes")
    .select(
      `id,
      quote_number,
      amount_ht,
      file_path,
      file_name,
      signed_file_path,
      signed_file_name,
      enterprise:enterprises(name, lot_number)`
    )
    .eq("project_id", projectId)
    .in("id", quoteIds);

  if (quotesError || !quotes?.length) {
    return { ok: false, error: "Devis introuvable(s)." };
  }

  const attachments: QuoteAttachment[] = [];
  const skipped: string[] = [];
  const lotNumbers: string[] = [];
  let totalHt = 0;

  for (const quote of quotes) {
    totalHt += Number(quote.amount_ht);
    const enterpriseRaw = quote.enterprise as unknown;
    const enterprise = (Array.isArray(enterpriseRaw) ? enterpriseRaw[0] : enterpriseRaw) as
      | { name: string; lot_number: string | null }
      | null
      | undefined;

    if (enterprise?.lot_number) {
      lotNumbers.push(enterprise.lot_number);
    }

    const filePath = quote.file_path ?? quote.signed_file_path;
    const fileName =
      quote.file_name ??
      quote.signed_file_name ??
      `Devis-${quote.quote_number || quote.id.slice(0, 8)}.pdf`;

    if (!filePath) {
      skipped.push(
        `${enterprise?.name ?? "Devis"} ${quote.quote_number || ""}`.trim() + " : pas de PDF"
      );
      continue;
    }

    const { data: pdfFile, error: downloadError } = await supabase.storage
      .from(FINANCIAL_BUCKET)
      .download(filePath);

    if (downloadError || !pdfFile) {
      skipped.push(
        `${enterprise?.name ?? "Devis"} ${quote.quote_number || ""}`.trim() +
          " : impossible de télécharger le PDF"
      );
      continue;
    }

    const pdfBase64 = Buffer.from(await pdfFile.arrayBuffer()).toString("base64");
    const { data: publicUrlData } = supabase.storage
      .from(FINANCIAL_BUCKET)
      .getPublicUrl(filePath);

    attachments.push({
      fileName,
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

  const emailTemplate = await getDevisMouEmailTemplate();
  const emailContent = buildDevisMouEmailFromTemplates(
    emailTemplate.subjectTemplate,
    emailTemplate.bodyTemplate,
    {
      projectName: project.name,
      lotNumbers,
      quoteCount: attachments.length,
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
    skipped.push("Maître d'ouvrage : pas d'email renseigné sur la fiche opération");
  }

  if (!recipients.length) {
    return {
      ok: false,
      error: `Aucun destinataire avec email. ${skipped.join(" · ")}`,
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
      quoteIds: quotes.map((q) => q.id),
    },
  };
}

async function markQuotesSentToMou(projectId: string, quoteIds: string[]) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from("financial_quotes")
    .update({ mou_sent_at: today })
    .eq("project_id", projectId)
    .in("id", quoteIds)
    .is("mou_sent_at", null);
}

export async function prepareDevisMouEmailPreview(
  projectId: string,
  quoteIds: string[]
): Promise<DevisMouEmailPreviewResult> {
  try {
    const assembled = await assembleDevisMouEmail(projectId, quoteIds);
    if (!assembled.ok) {
      return assembled;
    }

    const { subject, htmlBody, recipients, skipped, attachments, defaultCc } = assembled.data;

    return {
      ok: true,
      subject,
      htmlBody,
      recipients,
      skipped,
      attachments: attachments.map((a) => ({
        fileName: a.fileName,
        pdfUrl: a.pdfUrl,
      })),
      defaultCc,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Impossible de préparer le mail.",
    };
  }
}

export async function createDevisMouEmailDraft(
  projectId: string,
  quoteIds: string[],
  overrides?: DevisMouEmailOverrides
): Promise<DevisMouPrepareDraftResult> {
  try {
    const m365 = await getM365DraftReadiness();
    if (!m365.ready) {
      return { ok: false, error: m365.message ?? "Microsoft 365 non connecté." };
    }

    const user = await requireUser();
    const assembled = await assembleDevisMouEmail(projectId, quoteIds);
    if (!assembled.ok) {
      return assembled;
    }

    const resolved = resolveDevisMouEmailPayload(assembled.data, overrides);
    if (!resolved.ok) {
      return resolved;
    }

    const { subject, htmlBody, recipients, cc } = resolved.data;
    const { skipped, attachments, quoteIds: sentQuoteIds } = assembled.data;

    const draft = await createUserMailDraft(user.id, {
      subject,
      htmlBody,
      to: recipients,
      cc,
      attachments: attachments.map((a) => ({
        name: a.fileName,
        contentType: "application/pdf",
        contentBytes: a.pdfBase64,
      })),
    });

    await markQuotesSentToMou(projectId, sentQuoteIds);
    revalidatePath(`/pc/projets/${projectId}/suivi-financier/suivi-devis`);

    return {
      ok: true,
      webLink: draft.webLink ?? null,
      subject,
      recipients: recipients.map((r) => r.email),
      skipped,
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Erreur inconnue";
    return {
      ok: false,
      error: raw.includes("ErrorAccessDenied")
        ? "Microsoft refuse l'opération. Vérifiez Mail.ReadWrite + Mail.Send dans Azure et reconnectez M365 dans Profil."
        : raw,
    };
  }
}

export async function sendDevisMouEmail(
  projectId: string,
  quoteIds: string[],
  overrides?: DevisMouEmailOverrides
): Promise<DevisMouSendEmailResult> {
  try {
    const m365 = await getM365DraftReadiness();
    if (!m365.ready) {
      return { ok: false, error: m365.message ?? "Microsoft 365 non connecté." };
    }

    const user = await requireUser();
    const assembled = await assembleDevisMouEmail(projectId, quoteIds);
    if (!assembled.ok) {
      return assembled;
    }

    const resolved = resolveDevisMouEmailPayload(assembled.data, overrides);
    if (!resolved.ok) {
      return resolved;
    }

    const { subject, htmlBody, recipients, cc } = resolved.data;
    const { skipped, attachments, quoteIds: sentQuoteIds } = assembled.data;

    await sendUserMail(user.id, {
      subject,
      htmlBody,
      to: recipients,
      cc,
      attachments: attachments.map((a) => ({
        name: a.fileName,
        contentType: "application/pdf",
        contentBytes: a.pdfBase64,
      })),
    });

    await markQuotesSentToMou(projectId, sentQuoteIds);
    revalidatePath(`/pc/projets/${projectId}/suivi-financier/suivi-devis`);

    return {
      ok: true,
      subject,
      recipients: recipients.map((r) => r.email),
      skipped,
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Erreur inconnue";
    return {
      ok: false,
      error: raw.includes("ErrorAccessDenied")
        ? "Microsoft refuse l'opération. Vérifiez Mail.ReadWrite + Mail.Send dans Azure et reconnectez M365 dans Profil."
        : raw,
    };
  }
}

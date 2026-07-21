"use server";

import { revalidatePath } from "next/cache";
import { getAmendmentEmailTemplate } from "@/lib/actions/email-templates";
import { requireFinanceAccess } from "@/lib/actions/members";
import { getM365DraftReadiness } from "@/lib/actions/control-board";
import { createUserMailDraft, sendUserMail } from "@/lib/microsoft/graph";
import {
  normalizeRecipients,
  parseEmailList,
  validateEmailRecipients,
} from "@/lib/email/recipients";
import { requireUser } from "@/lib/auth/permissions";
import { buildAmendmentEmailFromTemplates } from "@/lib/notifications/amendment-email";
import { createClient } from "@/lib/supabase/server";

const FINANCIAL_BUCKET = "financial-files";

export type AmendmentEmailPreviewResult =
  | {
      ok: true;
      subject: string;
      htmlBody: string;
      recipients: { email: string; name: string }[];
      skipped: string[];
      pdfFileName: string;
      pdfUrl: string | null;
      defaultCc: string;
    }
  | { ok: false; error: string };

export type AmendmentEmailOverrides = {
  subject?: string;
  htmlBody?: string;
  recipients?: { email: string; name?: string | null }[];
  cc?: string;
};

export type AmendmentPrepareDraftResult =
  | {
      ok: true;
      webLink: string | null;
      subject: string;
      recipients: string[];
      skipped: string[];
    }
  | { ok: false; error: string };

export type AmendmentSendEmailResult =
  | { ok: true; subject: string; recipients: string[]; skipped: string[] }
  | { ok: false; error: string };

type AssembledAmendmentEmail = {
  subject: string;
  htmlBody: string;
  recipients: { email: string; name: string }[];
  skipped: string[];
  pdfFileName: string;
  pdfBase64: string;
  pdfUrl: string | null;
  defaultCc: string;
};

function resolveAmendmentEmailPayload(
  assembled: AssembledAmendmentEmail,
  overrides?: AmendmentEmailOverrides
):
  | { ok: true; data: { subject: string; htmlBody: string; recipients: { email: string; name: string }[]; cc: { email: string; name: string }[] } }
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

async function assembleAmendmentEmail(
  projectId: string,
  amendmentId: string
): Promise<{ ok: true; data: AssembledAmendmentEmail } | { ok: false; error: string }> {
  await requireFinanceAccess(projectId);
  const supabase = await createClient();

  const { data: amendment, error: amendmentError } = await supabase
    .from("financial_amendments")
    .select(
      `*,
      enterprise:enterprises!inner(
        project_id,
        name,
        lot_number,
        designation,
        contact_email,
        email_chantier,
        contact_name
      )`
    )
    .eq("id", amendmentId)
    .single();

  if (amendmentError || !amendment) {
    return { ok: false, error: "Avenant introuvable." };
  }

  const enterpriseRaw = amendment.enterprise as unknown;
  const enterprise = (Array.isArray(enterpriseRaw) ? enterpriseRaw[0] : enterpriseRaw) as {
    project_id: string;
    name: string;
    lot_number: string | null;
    designation: string | null;
    contact_email: string | null;
    email_chantier: string | null;
    contact_name: string | null;
  };

  if (enterprise.project_id !== projectId) {
    return { ok: false, error: "Avenant introuvable." };
  }

  if (!amendment.document_path) {
    return {
      ok: false,
      error: "Le PDF de l'avenant n'est pas encore disponible. Réessayez dans un instant.",
    };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return { ok: false, error: "Projet introuvable." };
  }

  const { data: pdfFile, error: downloadError } = await supabase.storage
    .from(FINANCIAL_BUCKET)
    .download(amendment.document_path);

  if (downloadError || !pdfFile) {
    return {
      ok: false,
      error: downloadError?.message ?? "Impossible de télécharger le PDF de l'avenant.",
    };
  }

  const pdfBase64 = Buffer.from(await pdfFile.arrayBuffer()).toString("base64");
  const pdfFileName =
    amendment.document_file_name ??
    `Avenant-${String(amendment.amendment_number).padStart(2, "0")}.pdf`;

  const { data: publicUrlData } = supabase.storage
    .from(FINANCIAL_BUCKET)
    .getPublicUrl(amendment.document_path);

  const emailTemplate = await getAmendmentEmailTemplate();
  const emailContent = buildAmendmentEmailFromTemplates(
    emailTemplate.subjectTemplate,
    emailTemplate.bodyTemplate,
    {
      projectName: project.name,
      amendmentNumber: amendment.amendment_number,
      amendmentType: amendment.amendment_type as "ts" | "tma",
      lotNumber: enterprise.lot_number,
      lotDesignation: enterprise.designation,
      enterpriseName: enterprise.name,
      amountHt: Number(amendment.amount_ht),
    }
  );

  const email = enterprise.email_chantier || enterprise.contact_email;
  const recipients: { email: string; name: string }[] = [];
  const skipped: string[] = [];

  if (email) {
    recipients.push({
      email,
      name: enterprise.contact_name || enterprise.name,
    });
  } else {
    skipped.push(`${enterprise.name} : pas d'email`);
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
      pdfFileName,
      pdfBase64,
      pdfUrl: publicUrlData.publicUrl ?? null,
      defaultCc: emailTemplate.defaultCc,
    },
  };
}

export async function prepareAmendmentEmailPreview(
  projectId: string,
  amendmentId: string
): Promise<AmendmentEmailPreviewResult> {
  try {
    const assembled = await assembleAmendmentEmail(projectId, amendmentId);
    if (!assembled.ok) {
      return assembled;
    }

    const { subject, htmlBody, recipients, skipped, pdfFileName, pdfUrl, defaultCc } =
      assembled.data;

    return {
      ok: true,
      subject,
      htmlBody,
      recipients,
      skipped,
      pdfFileName,
      pdfUrl,
      defaultCc,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Impossible de préparer le mail.",
    };
  }
}

export async function createAmendmentEmailDraft(
  projectId: string,
  amendmentId: string,
  overrides?: AmendmentEmailOverrides
): Promise<AmendmentPrepareDraftResult> {
  try {
    const m365 = await getM365DraftReadiness();
    if (!m365.ready) {
      return { ok: false, error: m365.message ?? "Microsoft 365 non connecté." };
    }

    const user = await requireUser();
    const assembled = await assembleAmendmentEmail(projectId, amendmentId);
    if (!assembled.ok) {
      return assembled;
    }

    const resolved = resolveAmendmentEmailPayload(assembled.data, overrides);
    if (!resolved.ok) {
      return resolved;
    }

    const { subject, htmlBody, recipients, cc } = resolved.data;
    const { skipped, pdfFileName, pdfBase64 } = assembled.data;

    const draft = await createUserMailDraft(user.id, {
      subject,
      htmlBody,
      to: recipients,
      cc,
      attachments: [
        {
          name: pdfFileName,
          contentType: "application/pdf",
          contentBytes: pdfBase64,
        },
      ],
    });

    revalidatePath(`/pc/projets/${projectId}/suivi-financier/avenants`);

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

export async function sendAmendmentEmail(
  projectId: string,
  amendmentId: string,
  overrides?: AmendmentEmailOverrides
): Promise<AmendmentSendEmailResult> {
  try {
    const m365 = await getM365DraftReadiness();
    if (!m365.ready) {
      return { ok: false, error: m365.message ?? "Microsoft 365 non connecté." };
    }

    const user = await requireUser();
    const assembled = await assembleAmendmentEmail(projectId, amendmentId);
    if (!assembled.ok) {
      return assembled;
    }

    const resolved = resolveAmendmentEmailPayload(assembled.data, overrides);
    if (!resolved.ok) {
      return resolved;
    }

    const { subject, htmlBody, recipients, cc } = resolved.data;
    const { skipped, pdfFileName, pdfBase64 } = assembled.data;

    await sendUserMail(user.id, {
      subject,
      htmlBody,
      to: recipients,
      cc,
      attachments: [
        {
          name: pdfFileName,
          contentType: "application/pdf",
          contentBytes: pdfBase64,
        },
      ],
    });

    revalidatePath(`/pc/projets/${projectId}/suivi-financier/avenants`);

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

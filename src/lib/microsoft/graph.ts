import { getNotificationSenderEmail } from "@/lib/microsoft/config";
import { fetchApplicationAccessToken } from "@/lib/microsoft/oauth";
import { getValidUserAccessToken } from "@/lib/microsoft/m365-store";

type EmailRecipient = {
  email: string;
  name?: string | null;
};

type SendEmailInput = {
  subject: string;
  htmlBody: string;
  to: EmailRecipient[];
  cc?: EmailRecipient[];
};

export type MailAttachment = {
  name: string;
  contentType: string;
  contentBytes: string;
};

type UserMailInput = SendEmailInput & {
  attachments?: MailAttachment[];
};

function toGraphRecipients(recipients: EmailRecipient[]) {
  return recipients.map((recipient) => ({
    emailAddress: {
      address: recipient.email,
      name: recipient.name ?? undefined,
    },
  }));
}

function buildGraphMessage(input: UserMailInput) {
  const message: Record<string, unknown> = {
    subject: input.subject,
    body: {
      contentType: "HTML",
      content: input.htmlBody,
    },
    toRecipients: toGraphRecipients(input.to),
  };

  if (input.cc?.length) {
    message.ccRecipients = toGraphRecipients(input.cc);
  }

  if (input.attachments?.length) {
    message.attachments = input.attachments.map((att) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: att.name,
      contentType: att.contentType,
      contentBytes: att.contentBytes,
    }));
  }

  return message;
}

async function sendViaGraph(
  accessToken: string,
  senderEmail: string,
  input: SendEmailInput
) {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: buildGraphMessage(input),
        saveToSentItems: true,
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Envoi Graph échoué : ${detail}`);
  }
}

export async function sendNotificationEmail(input: SendEmailInput) {
  const senderEmail = getNotificationSenderEmail();
  if (!senderEmail) {
    throw new Error("NOTIFICATION_SENDER_EMAIL n'est pas configuré.");
  }

  const accessToken = await fetchApplicationAccessToken();
  await sendViaGraph(accessToken, senderEmail, input);
}

export async function sendUserMail(userId: string, input: UserMailInput) {
  const accessToken = await getValidUserAccessToken(userId);
  if (!accessToken) {
    throw new Error("Compte Microsoft 365 non connecté.");
  }

  const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: buildGraphMessage(input),
      saveToSentItems: true,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Envoi du mail échoué : ${detail}`);
  }
}

export async function createUserMailDraft(userId: string, input: UserMailInput) {
  const accessToken = await getValidUserAccessToken(userId);
  if (!accessToken) {
    throw new Error("Compte Microsoft 365 non connecté.");
  }

  const response = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildGraphMessage(input)),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Création du brouillon échouée : ${detail}`);
  }

  return response.json() as Promise<{ id: string; webLink?: string }>;
}

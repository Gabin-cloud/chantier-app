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
};

export type MailAttachment = {
  name: string;
  contentType: string;
  contentBytes: string;
};

type CreateDraftInput = SendEmailInput & {
  attachments?: MailAttachment[];
};

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
        message: {
          subject: input.subject,
          body: {
            contentType: "HTML",
            content: input.htmlBody,
          },
          toRecipients: input.to.map((recipient) => ({
            emailAddress: {
              address: recipient.email,
              name: recipient.name ?? undefined,
            },
          })),
        },
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

export async function createUserMailDraft(
  userId: string,
  input: CreateDraftInput
) {
  const accessToken = await getValidUserAccessToken(userId);
  if (!accessToken) {
    throw new Error("Compte Microsoft 365 non connecté.");
  }

  const message: Record<string, unknown> = {
    subject: input.subject,
    body: {
      contentType: "HTML",
      content: input.htmlBody,
    },
    toRecipients: input.to.map((recipient) => ({
      emailAddress: {
        address: recipient.email,
        name: recipient.name ?? undefined,
      },
    })),
  };

  if (input.attachments?.length) {
    message.attachments = input.attachments.map((att) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: att.name,
      contentType: att.contentType,
      contentBytes: att.contentBytes,
    }));
  }

  const response = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Création du brouillon échouée : ${detail}`);
  }

  return response.json() as Promise<{ id: string; webLink?: string }>;
}

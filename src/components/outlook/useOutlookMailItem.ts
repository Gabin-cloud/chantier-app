"use client";

import { useEffect, useState } from "react";

type MailAttachment = {
  id: string;
  name: string;
  contentType: string;
  size: number;
};

type MailContext = {
  subject: string;
  fromEmail: string;
  fromName: string;
  attachments: MailAttachment[];
};

function base64ToFile(base64: string, filename: string, contentType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, {
    type: contentType || "application/octet-stream",
  });
}

function getAttachmentContent(
  item: Office.MailboxItem,
  attachmentId: string
): Promise<Office.AttachmentContent> {
  return new Promise((resolve, reject) => {
    item.getAttachmentContentAsync(attachmentId, (result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        resolve(result.value);
      } else {
        reject(new Error(result.error?.message ?? "Impossible de lire la pièce jointe."));
      }
    });
  });
}

export function useOutlookMailItem() {
  const [ready, setReady] = useState(false);
  const [outsideOutlook, setOutsideOutlook] = useState(false);
  const [mail, setMail] = useState<MailContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mailboxItem, setMailboxItem] = useState<Office.MailboxItem | null>(null);

  useEffect(() => {
    function init() {
      if (typeof Office === "undefined") {
        setOutsideOutlook(true);
        return;
      }

      Office.onReady((info) => {
        if (info.host !== Office.HostType.Outlook) {
          setOutsideOutlook(true);
          return;
        }

        setReady(true);
        try {
          const item = Office.context.mailbox.item;
          if (!item || item.itemType !== Office.MailboxEnums.ItemType.Message) {
            setError("Ouvrez un e-mail en lecture pour classer ses pièces jointes.");
            return;
          }

          setMailboxItem(item);
          setMail({
            subject: item.subject ?? "",
            fromEmail: item.from?.emailAddress ?? "",
            fromName: item.from?.displayName ?? "",
            attachments: (item.attachments ?? [])
              .filter((att) => !att.isInline)
              .map((att) => ({
                id: att.id,
                name: att.name,
                contentType: att.contentType,
                size: att.size,
              })),
          });
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Erreur de lecture du mail."
          );
        }
      });
    }

    init();
  }, []);

  async function loadAttachmentFile(attachmentId: string): Promise<File> {
    if (!mailboxItem || !mail) {
      throw new Error("Aucun mail ouvert.");
    }

    const attachment = mail.attachments.find((att) => att.id === attachmentId);
    if (!attachment) {
      throw new Error("Pièce jointe introuvable.");
    }

    const content = await getAttachmentContent(mailboxItem, attachmentId);

    if (content.format === "url") {
      throw new Error(
        "Cette pièce jointe est stockée dans le cloud — enregistrez-la localement puis utilisez la version bureau."
      );
    }

    return base64ToFile(content.content, attachment.name, attachment.contentType);
  }

  return {
    ready,
    outsideOutlook,
    mail,
    error,
    loadAttachmentFile,
  };
}

declare namespace Office {
  enum AsyncResultStatus {
    Succeeded = "succeeded",
    Failed = "failed",
  }

  namespace MailboxEnums {
    enum ItemType {
      Message = "message",
      Appointment = "appointment",
    }

    enum AttachmentType {
      File = "file",
      Item = "item",
      Cloud = "cloud",
    }
  }

  enum HostType {
    Outlook = "Outlook",
    Word = "Word",
  }

  const HostType: {
    Outlook: "Outlook";
    Word: "Word";
  };

  interface AttachmentDetails {
    id: string;
    name: string;
    contentType: string;
    size: number;
    attachmentType: MailboxEnums.AttachmentType;
    isInline: boolean;
  }

  interface EmailAddressDetails {
    displayName: string;
    emailAddress: string;
  }

  interface AttachmentContent {
    content: string;
    format: "base64" | "url";
  }

  interface AsyncResult<T> {
    status: AsyncResultStatus;
    value: T;
    error?: { message: string };
  }

  interface MailboxItem {
    itemType: MailboxEnums.ItemType;
    subject: string;
    from: EmailAddressDetails;
    attachments: AttachmentDetails[];
    getAttachmentContentAsync(
      attachmentId: string,
      callback: (result: AsyncResult<AttachmentContent>) => void
    ): void;
  }

  interface Mailbox {
    item: MailboxItem;
  }

  interface Context {
    mailbox: Mailbox;
  }

  interface OfficeInfo {
    host: string;
    platform: string;
  }

  function onReady(callback: (info: { host: string; platform: string }) => void): void;

  const context: Context;
}

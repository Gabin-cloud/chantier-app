export type EmailRecipientInput = {
  email: string;
  name: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmailList(raw: string): EmailRecipientInput[] {
  return raw
    .split(/[;,]/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((email) => ({ email, name: email }));
}

export function validateEmailRecipients(
  recipients: EmailRecipientInput[],
  label = "destinataire"
): string | null {
  if (!recipients.length) {
    return `Ajoutez au moins un ${label}.`;
  }
  const invalid = recipients.find((r) => !EMAIL_PATTERN.test(r.email));
  if (invalid) {
    return `Adresse e-mail invalide : ${invalid.email}`;
  }
  return null;
}

export function normalizeRecipients(
  recipients: { email: string; name?: string | null }[]
): EmailRecipientInput[] {
  return recipients
    .map((r) => ({
      email: r.email.trim(),
      name: r.name?.trim() || r.email.trim(),
    }))
    .filter((r) => r.email);
}

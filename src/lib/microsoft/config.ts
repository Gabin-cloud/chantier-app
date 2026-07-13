export const MICROSOFT_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Mail.ReadWrite",
  "Mail.Send",
].join(" ");

export function isMicrosoftOAuthConfigured() {
  return Boolean(
    process.env.AZURE_CLIENT_ID &&
      process.env.AZURE_CLIENT_SECRET &&
      process.env.AZURE_TENANT_ID
  );
}

export function isNotificationEmailConfigured() {
  return Boolean(
    isMicrosoftOAuthConfigured() && process.env.NOTIFICATION_SENDER_EMAIL
  );
}

export function getMicrosoftRedirectUri(origin: string) {
  return (
    process.env.MICROSOFT_REDIRECT_URI ??
    `${origin}/api/auth/microsoft/callback`
  );
}

export function getAzureTenantId() {
  return process.env.AZURE_TENANT_ID ?? "common";
}

export function getNotificationSenderEmail() {
  return process.env.NOTIFICATION_SENDER_EMAIL ?? "";
}

export class MicrosoftConsentRequiredError extends Error {
  constructor(
    message = "Autorisation SharePoint requise. Reconnectez votre compte Microsoft 365."
  ) {
    super(message);
    this.name = "MicrosoftConsentRequiredError";
  }
}

export function isMicrosoftConsentRequired(detail: string): boolean {
  const lower = detail.toLowerCase();
  return (
    lower.includes("consent_required") ||
    lower.includes("aadsts65001") ||
    (lower.includes("invalid_grant") && lower.includes("consent"))
  );
}

export function formatMicrosoftAuthError(detail: string): string {
  if (isMicrosoftConsentRequired(detail)) {
    return (
      "Votre compte Microsoft 365 doit être reconnecté pour autoriser l'accès SharePoint. " +
      "Cliquez sur « Autoriser SharePoint » ci-dessous."
    );
  }
  return detail;
}

export function needsMicrosoftConsentRenewal(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("consent") ||
    lower.includes("aadsts65001") ||
    lower.includes("autoriser sharepoint") ||
    lower.includes("reconnectez votre compte microsoft")
  );
}

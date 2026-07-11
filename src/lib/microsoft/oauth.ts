import {
  getAzureTenantId,
  getMicrosoftRedirectUri,
  MICROSOFT_SCOPES,
} from "@/lib/microsoft/config";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

type MicrosoftUser = {
  id: string;
  mail?: string | null;
  userPrincipalName?: string;
};

export function buildMicrosoftAuthorizeUrl(origin: string, state: string) {
  const clientId = process.env.AZURE_CLIENT_ID!;
  const redirectUri = getMicrosoftRedirectUri(origin);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: MICROSOFT_SCOPES,
    state,
    prompt: "select_account",
  });

  return `https://login.microsoftonline.com/${getAzureTenantId()}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeMicrosoftCode(
  origin: string,
  code: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID!,
    client_secret: process.env.AZURE_CLIENT_SECRET!,
    grant_type: "authorization_code",
    code,
    redirect_uri: getMicrosoftRedirectUri(origin),
    scope: MICROSOFT_SCOPES,
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${getAzureTenantId()}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Échec de la connexion Microsoft : ${detail}`);
  }

  return response.json();
}

export async function refreshMicrosoftToken(
  refreshToken: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID!,
    client_secret: process.env.AZURE_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: MICROSOFT_SCOPES,
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${getAzureTenantId()}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Impossible de renouveler le token Microsoft : ${detail}`);
  }

  return response.json();
}

export async function fetchMicrosoftUser(accessToken: string): Promise<MicrosoftUser> {
  const response = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Impossible de lire le profil Microsoft : ${detail}`);
  }

  return response.json();
}

export async function fetchApplicationAccessToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID!,
    client_secret: process.env.AZURE_CLIENT_SECRET!,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${getAzureTenantId()}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Impossible d'obtenir le token application : ${detail}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

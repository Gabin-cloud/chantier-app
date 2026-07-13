import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/microsoft/crypto";
import { refreshMicrosoftToken } from "@/lib/microsoft/oauth";
import { MicrosoftConsentRequiredError } from "@/lib/microsoft/errors";

export type M365ConnectionPublic = {
  msEmail: string;
  connectedAt: string;
};

type M365ConnectionRow = {
  user_id: string;
  ms_user_id: string;
  ms_email: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  connected_at: string;
};

export async function getM365ConnectionPublic(
  userId: string
): Promise<M365ConnectionPublic | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_m365_connections")
    .select("ms_email, connected_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    msEmail: data.ms_email,
    connectedAt: data.connected_at,
  };
}

export async function saveM365Connection(input: {
  userId: string;
  msUserId: string;
  msEmail: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}) {
  const supabase = createAdminClient();
  const expiresAt = new Date(Date.now() + input.expiresIn * 1000).toISOString();

  const { error } = await supabase.from("user_m365_connections").upsert(
    {
      user_id: input.userId,
      ms_user_id: input.msUserId,
      ms_email: input.msEmail,
      access_token: encryptSecret(input.accessToken),
      refresh_token: encryptSecret(input.refreshToken),
      token_expires_at: expiresAt,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw new Error(error.message);
}

export async function deleteM365Connection(userId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_m365_connections")
    .delete()
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function getValidUserAccessToken(userId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_m365_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as M365ConnectionRow;
  const expiresAt = new Date(row.token_expires_at).getTime();
  const accessToken = decryptSecret(row.access_token);

  if (Date.now() < expiresAt - 60_000) {
    return accessToken;
  }

  const refreshToken = decryptSecret(row.refresh_token);

  try {
    const refreshed = await refreshMicrosoftToken(refreshToken);
    const newExpiresAt = new Date(
      Date.now() + refreshed.expires_in * 1000
    ).toISOString();

    const { error: updateError } = await supabase
      .from("user_m365_connections")
      .update({
        access_token: encryptSecret(refreshed.access_token),
        refresh_token: encryptSecret(
          refreshed.refresh_token ?? refreshToken
        ),
        token_expires_at: newExpiresAt,
      })
      .eq("user_id", userId);

    if (updateError) throw new Error(updateError.message);
    return refreshed.access_token;
  } catch (error) {
    if (error instanceof MicrosoftConsentRequiredError) {
      await deleteM365Connection(userId);
    }
    throw error;
  }
}

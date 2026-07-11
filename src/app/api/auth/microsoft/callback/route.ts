import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeMicrosoftCode,
  fetchMicrosoftUser,
} from "@/lib/microsoft/oauth";
import { saveM365Connection } from "@/lib/microsoft/m365-store";

const STATE_COOKIE = "ms_oauth_state";
const RETURN_COOKIE = "ms_oauth_return";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error_description");

  const returnTo =
    request.headers.get("cookie")?.includes(`${RETURN_COOKIE}=`) ?
      decodeReturnCookie(request.headers.get("cookie")!) :
      "/pc/profil";

  const redirectBase = new URL(returnTo, origin);

  if (oauthError) {
    redirectBase.searchParams.set("microsoft", "error");
    redirectBase.searchParams.set("message", oauthError);
    return clearCookiesAndRedirect(redirectBase);
  }

  const storedState = getCookieValue(request.headers.get("cookie"), STATE_COOKIE);
  if (!code || !state || !storedState || state !== storedState) {
    redirectBase.searchParams.set("microsoft", "error");
    redirectBase.searchParams.set(
      "message",
      "Session OAuth invalide ou expirée."
    );
    return clearCookiesAndRedirect(redirectBase);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  try {
    const tokenResponse = await exchangeMicrosoftCode(origin, code);
    const msUser = await fetchMicrosoftUser(tokenResponse.access_token);
    const msEmail = msUser.mail ?? msUser.userPrincipalName;

    if (!msEmail || !tokenResponse.refresh_token) {
      throw new Error("Informations Microsoft incomplètes.");
    }

    await saveM365Connection({
      userId: user.id,
      msUserId: msUser.id,
      msEmail,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresIn: tokenResponse.expires_in,
    });

    redirectBase.searchParams.set("microsoft", "connected");
  } catch (error) {
    redirectBase.searchParams.set("microsoft", "error");
    redirectBase.searchParams.set(
      "message",
      error instanceof Error ? error.message : "Connexion Microsoft échouée."
    );
  }

  return clearCookiesAndRedirect(redirectBase);
}

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function decodeReturnCookie(cookieHeader: string) {
  return getCookieValue(cookieHeader, RETURN_COOKIE) ?? "/pc/profil";
}

function clearCookiesAndRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, "", { maxAge: 0, path: "/" });
  response.cookies.set(RETURN_COOKIE, "", { maxAge: 0, path: "/" });
  return response;
}

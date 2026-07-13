import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildMicrosoftAuthorizeUrl } from "@/lib/microsoft/oauth";
import { isMicrosoftOAuthConfigured } from "@/lib/microsoft/config";
import { isAdminClientConfigured } from "@/lib/supabase/admin";
import { isTokenEncryptionConfigured } from "@/lib/microsoft/crypto";

const STATE_COOKIE = "ms_oauth_state";
const RETURN_COOKIE = "ms_oauth_return";

export async function GET(request: Request) {
  if (
    !isMicrosoftOAuthConfigured() ||
    !isAdminClientConfigured() ||
    !isTokenEncryptionConfigured()
  ) {
    return NextResponse.json(
      { error: "Connexion Microsoft 365 non configurée côté serveur." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams, origin } = new URL(request.url);
  const returnTo = searchParams.get("returnTo") ?? "/pc/profil";
  const requireConsent = searchParams.get("consent") === "1";
  const safeReturnTo =
    returnTo.startsWith("/pc/") || returnTo.startsWith("/tablette/")
      ? returnTo
      : "/pc/profil";

  const state = randomBytes(24).toString("base64url");
  const authorizeUrl = buildMicrosoftAuthorizeUrl(origin, state, {
    requireConsent,
  });
  const response = NextResponse.redirect(authorizeUrl);

  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  response.cookies.set(RETURN_COOKIE, safeReturnTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}

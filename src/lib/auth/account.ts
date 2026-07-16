import { createClient } from "@/lib/supabase/server";
import type { AccountKind } from "@/lib/types/database";

export type AccountRouteContext = {
  accountKind: AccountKind;
  homePath: "/pc" | "/tablette" | "/entreprise";
};

function isTabletUserAgent(ua: string | null) {
  if (!ua) return false;
  return (
    /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) ||
    (ua.includes("Macintosh") && ua.includes("Mobile"))
  );
}

/** Chemin d'accueil selon le type de compte et l'appareil. */
export function homePathForAccount(
  accountKind: AccountKind,
  userAgent?: string | null
): "/pc" | "/tablette" | "/entreprise" {
  if (accountKind === "entreprise") return "/entreprise";
  return isTabletUserAgent(userAgent ?? null) ? "/tablette" : "/pc";
}

export function canAccessInterface(
  accountKind: AccountKind,
  pathname: string
): boolean {
  if (accountKind === "entreprise") {
    return (
      pathname.startsWith("/entreprise") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/auth")
    );
  }
  // DANOBAT : PC + tablette (pas le portail entreprise)
  return (
    pathname.startsWith("/pc") ||
    pathname.startsWith("/tablette") ||
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/outlook")
  );
}

export async function getAccountKind(userId: string): Promise<AccountKind> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("account_kind")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.account_kind as AccountKind | undefined) ?? "danobat";
}

export async function resolveAccountRoute(
  userId: string,
  userAgent?: string | null
): Promise<AccountRouteContext> {
  const accountKind = await getAccountKind(userId);
  return {
    accountKind,
    homePath: homePathForAccount(accountKind, userAgent),
  };
}

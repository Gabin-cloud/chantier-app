import { homePathForAccount } from "@/lib/auth/account";
import { createClient } from "@/lib/supabase/server";
import type { AccountKind } from "@/lib/types/database";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("account_kind")
          .eq("id", user.id)
          .maybeSingle();
        const accountKind =
          (profile?.account_kind as AccountKind | undefined) ?? "danobat";
        const ua = request.headers.get("user-agent");
        const home = homePathForAccount(accountKind, ua);

        let target: string = home;
        if (
          accountKind === "entreprise" &&
          typeof next === "string" &&
          next.startsWith("/entreprise")
        ) {
          target = next;
        } else if (
          accountKind === "danobat" &&
          typeof next === "string" &&
          (next.startsWith("/pc") || next.startsWith("/tablette"))
        ) {
          target = next;
        }

        return NextResponse.redirect(`${origin}${target}`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}

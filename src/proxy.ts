import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type AccountKind = "danobat" | "entreprise";

function isTabletUserAgent(ua: string) {
  return (
    /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) ||
    (ua.includes("Macintosh") && ua.includes("Mobile"))
  );
}

function homeForKind(kind: AccountKind, ua: string) {
  if (kind === "entreprise") return "/entreprise";
  return isTabletUserAgent(ua) ? "/tablette" : "/pc";
}

export async function proxy(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.next({ request });
    }

    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    const { data: userData } = await supabase.auth.getUser();
    // Pas de session = visiteur anonyme (getUser peut renvoyer une erreur
    // Auth session missing — ce n'est pas un crash).
    const user = userData.user ?? null;

    const { pathname } = request.nextUrl;
    const ua = request.headers.get("user-agent") ?? "";

    const isProtected =
      pathname.startsWith("/pc") ||
      pathname.startsWith("/tablette") ||
      pathname.startsWith("/entreprise");
    const isAuthPage = pathname.startsWith("/login");

    if (!user && isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    let accountKind: AccountKind = "danobat";
    if (user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("account_kind")
        .eq("id", user.id)
        .maybeSingle();

      if (!profileError && profile?.account_kind === "entreprise") {
        accountKind = "entreprise";
      }
    }

    if (user && isAuthPage) {
      const requested = request.nextUrl.searchParams.get("redirect");
      const home = homeForKind(accountKind, ua);
      let target = home;

      if (requested) {
        if (accountKind === "entreprise" && requested.startsWith("/entreprise")) {
          target = requested;
        } else if (
          accountKind === "danobat" &&
          (requested.startsWith("/pc") || requested.startsWith("/tablette"))
        ) {
          target = requested;
        }
      }

      return NextResponse.redirect(new URL(target, request.url));
    }

    if (user) {
      const home = homeForKind(accountKind, ua);

      if (accountKind === "entreprise") {
        if (
          pathname === "/" ||
          pathname.startsWith("/pc") ||
          pathname.startsWith("/tablette")
        ) {
          return NextResponse.redirect(new URL("/entreprise", request.url));
        }
      } else {
        if (pathname.startsWith("/entreprise")) {
          return NextResponse.redirect(new URL(home, request.url));
        }
        if (pathname === "/") {
          return NextResponse.redirect(new URL(home, request.url));
        }
      }
    } else if (pathname === "/" && isTabletUserAgent(ua)) {
      const url = request.nextUrl.clone();
      url.pathname = "/tablette";
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch {
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: ["/", "/pc/:path*", "/tablette/:path*", "/entreprise/:path*", "/login"],
};

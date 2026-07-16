import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { AccountKind } from "@/lib/types/database";

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

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_kind")
      .eq("id", user.id)
      .maybeSingle();
    accountKind = (profile?.account_kind as AccountKind | undefined) ?? "danobat";
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

    // Comptes entreprise : uniquement /entreprise
    if (accountKind === "entreprise") {
      if (
        pathname === "/" ||
        pathname.startsWith("/pc") ||
        pathname.startsWith("/tablette")
      ) {
        return NextResponse.redirect(new URL("/entreprise", request.url));
      }
    } else {
      // Comptes DANOBAT : PC / tablette, pas le portail entreprise
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
}

export const config = {
  matcher: ["/", "/pc/:path*", "/tablette/:path*", "/entreprise/:path*", "/login"],
};

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  if (pathname === "/") {
    const ua = request.headers.get("user-agent") ?? "";
    const isTablet =
      /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) ||
      (ua.includes("Macintosh") && ua.includes("Mobile"));
    if (isTablet) {
      const url = request.nextUrl.clone();
      url.pathname = "/tablette";
      return NextResponse.redirect(url);
    }
  }

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

  if (user && isAuthPage) {
    const redirect = request.nextUrl.searchParams.get("redirect") ?? "/";
    return NextResponse.redirect(new URL(redirect, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/", "/pc/:path*", "/tablette/:path*", "/entreprise/:path*", "/login"],
};

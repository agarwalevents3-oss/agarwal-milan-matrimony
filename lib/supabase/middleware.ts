import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase session cookie on each matched request and applies
 * coarse redirects.
 *
 * These redirects are a courtesy, not a security boundary — a user who bypasses
 * them still hits RLS and the server-side guards and gets nothing (PRD §15.2).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalidates the token with Supabase; getSession() would trust
  // whatever the cookie claims, which is not good enough for a redirect gate.
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const isAuthedArea =
    pathname.startsWith("/dashboard") || pathname.startsWith("/profile") ||
    pathname.startsWith("/profiles") || pathname.startsWith("/notifications") ||
    pathname.startsWith("/interests") || pathname.startsWith("/matches") ||
    pathname.startsWith("/status") || pathname.startsWith("/payment");
  const isAdminArea = pathname.startsWith("/admin");

  if (!user && (isAuthedArea || isAdminArea)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  // /register is deliberately NOT redirected here: a signed-in user may be
  // resuming an interrupted DRAFT registration. That decision needs the
  // registration status, which the page reads once rather than this proxy
  // reading it on every single request.
  if (user && pathname === "/login") {
    const home = request.nextUrl.clone();
    home.pathname = "/dashboard";
    home.search = "";
    return NextResponse.redirect(home);
  }

  if (user && isAdminArea) {
    // The claim is only a hint here; every /api/admin route re-checks the
    // database, and RLS enforces it independently.
    const role = (user.app_metadata as { role?: string } | null)?.role;
    if (role !== "admin") {
      const home = request.nextUrl.clone();
      home.pathname = "/dashboard";
      return NextResponse.redirect(home);
    }
  }

  return response;
}

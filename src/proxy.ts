import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

const AUTH_ROUTE = "/login";
const DEFAULT_PROTECTED = "/dashboard";

/** Routes that do NOT require authentication. Everything else is protected. */
const PUBLIC_ROUTES = ["/", "/login"];

/**
 * Next.js 16 Proxy (formerly `middleware`). Refreshes the Supabase session on
 * every matched request, then gates routes by auth state. Redirects copy over the
 * refreshed auth cookies so sessions are never silently dropped.
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
  const isAuthRoute = pathname === AUTH_ROUTE;

  // Unauthenticated request to a protected path → send to the auth route.
  if (!user && !isPublic) {
    return redirectPreservingCookies(request, response, AUTH_ROUTE);
  }

  // Authenticated request to the auth route → send to the dashboard.
  if (user && isAuthRoute) {
    return redirectPreservingCookies(request, response, DEFAULT_PROTECTED);
  }

  return response;
}

/** Build a redirect that carries over the session-refresh `Set-Cookie` headers. */
function redirectPreservingCookies(
  request: NextRequest,
  sessionResponse: NextResponse,
  pathname: string
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const redirect = NextResponse.redirect(url);
  sessionResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image files so the session
     * refresh does not run on every asset (PRD: low QPS, keep middleware cheap).
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

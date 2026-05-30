import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresh the Supabase session for an incoming request using the `@supabase/ssr`
 * cookie pattern. Returns the response carrying any refreshed auth `Set-Cookie`
 * headers plus the resolved user. Callers that issue their own redirect must copy
 * `response.cookies` onto it so the refreshed session is not dropped.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() refreshes the token; do not run logic between client
  // creation and this call (per @supabase/ssr guidance).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}

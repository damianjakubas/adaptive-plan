import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * Per-request memoized authenticated user for Server Components. On a hard load
 * the (app) layout and the page each verify auth; `cache` collapses those into a
 * single Auth-server round-trip. Middleware, route handlers, and server actions
 * keep their own direct calls — they run outside the RSC render.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

/**
 * Shared auth route paths. Centralized here so the redirect sites — `signIn`,
 * `signUp`, `signOut` (actions.ts) and the proxy's authenticated-on-`/login`
 * bounce (proxy.ts) — cannot drift apart, and a future landing change is a single edit.
 */
export const AUTH_ROUTE = "/login";
export const POST_AUTH_LANDING = "/dashboard";

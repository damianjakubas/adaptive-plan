import type { AuthError } from "@supabase/supabase-js";

/**
 * Localizable error codes the UI maps to `AuthErrors.*` next-intl messages.
 * Keep in sync with the `AuthErrors` namespace in `src/i18n/messages/*.json`.
 */
export type AuthErrorCode =
  | "invalid_credentials"
  | "email_exists"
  | "weak_password"
  | "generic";

/** Structured result returned to the client on failure (success redirects). */
export type AuthResult = { ok: false; code: AuthErrorCode };

/**
 * Translate a Supabase `AuthError` into one of our localizable codes. Prefers
 * the typed `error.code` and falls back to message heuristics for older shapes.
 */
export function mapAuthError(error: AuthError): AuthErrorCode {
  switch (error.code) {
    case "invalid_credentials":
      return "invalid_credentials";
    case "user_already_exists":
    case "email_exists":
      return "email_exists";
    case "weak_password":
      return "weak_password";
    default: {
      const message = error.message?.toLowerCase() ?? "";
      if (message.includes("already registered") || message.includes("already exists")) {
        return "email_exists";
      }
      if (message.includes("invalid login")) {
        return "invalid_credentials";
      }
      if (message.includes("password")) {
        return "weak_password";
      }
      return "generic";
    }
  }
}

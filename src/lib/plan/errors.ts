/**
 * Localizable plan-generation error codes the UI maps to `PlanErrors.*` next-intl
 * messages (mirrors `src/lib/auth/errors.ts`). Keep in sync with the `PlanErrors`
 * namespace in `src/i18n/messages/*.json` (added in Phase 5).
 */
export type PlanErrorCode =
  | "generation_failed"
  | "invalid_parameters"
  | "rate_limited"
  | "unauthenticated"
  | "generic";

/** Structured failure body returned by the generation route. */
export type PlanErrorResult = { code: PlanErrorCode };

/**
 * Translate a provider/HTTP failure into one of our localizable codes. Rate-limit
 * responses (HTTP 429 / quota messages) become `rate_limited`; everything else maps
 * to `generation_failed`. Used by the route and reusable by the client.
 */
export function mapPlanError(error: unknown): PlanErrorCode {
  const status =
    typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode?: unknown }).statusCode)
      : undefined;

  if (status === 429) {
    return "rate_limited";
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("rate limit") || message.includes("quota") || message.includes("429")) {
    return "rate_limited";
  }

  return "generation_failed";
}

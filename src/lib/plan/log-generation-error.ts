export function logGenerationError(context: { error: unknown; stage: string }): void {
  // eslint-disable-next-line no-console
  console.error("[plan-generation]", context.stage, context.error);
}

export function logGenerationError(context: { error: unknown; stage: string }): void {
  console.error("[plan-generation]", context.stage, context.error);
}

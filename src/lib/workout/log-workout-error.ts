export function logWorkoutError(context: { error: unknown; stage: string }): void {
  // eslint-disable-next-line no-console
  console.error("[workout-session]", context.stage, context.error);
}

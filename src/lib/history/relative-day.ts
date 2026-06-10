/**
 * Classify a session's `performedAt` against `now` so the date cell can show
 * the mockup's primary label (Today / Yesterday / weekday / date) without the
 * component owning calendar math. Returns a discriminant, not display text —
 * translation and date formatting stay in the component.
 *
 * Comparison is **calendar-date based, not a 24-hour window**: "today" means
 * the same calendar date as `now`, "yesterday" the previous calendar date, a
 * weekday label for 2–6 calendar days back, and a plain date for ≥7 days back
 * or any future date (clock skew degrades to `"date"`, never a crash).
 *
 * `now` is an explicit parameter so tests can inject a fixed clock and the page
 * passes `new Date()`. Comparisons use the runtime's local calendar (see the
 * plan's Critical Implementation Details — acceptable for this solo-first app;
 * no timezone library).
 */
function getRelativeDay(performedAt: Date, now: Date): RelativeDayKind {
  const performedMidnight = startOfDay(performedAt);
  const nowMidnight = startOfDay(now);
  const dayDiff = Math.round(
    (nowMidnight - performedMidnight) / MILLISECONDS_PER_DAY,
  );

  if (dayDiff === 0) {
    return "today";
  }
  if (dayDiff === 1) {
    return "yesterday";
  }
  if (dayDiff >= 2 && dayDiff <= 6) {
    return "weekday";
  }
  return "date";
}

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

type RelativeDayKind = "today" | "yesterday" | "weekday" | "date";

export { type RelativeDayKind };
export default getRelativeDay;

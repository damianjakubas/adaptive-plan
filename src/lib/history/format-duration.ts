/**
 * Render a session's `durationMinutes` compactly, matching the mockup's
 * notation (`75` → `"1h 15m"`, `45` → `"45m"`, `120` → `"2h"`). Locale-
 * independent: the mockup uses the same `h`/`m` notation in PL and EN, so this
 * is a pure function with no i18n dependency.
 *
 * - Whole hours omit the minutes part (`"2h"`, never `"2h 0m"`).
 * - Under an hour omits the hours part (`"45m"`).
 * - `0` → `"0m"` (never an empty string).
 *
 * Inputs are coerced to a non-negative whole number of minutes; fractional or
 * negative values (clock skew / bad data) degrade gracefully rather than
 * surfacing as `NaN`.
 */
function formatDuration(minutes: number): string {
  const total = Math.max(Math.trunc(minutes), 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;

  if (hours === 0) {
    return `${mins}m`;
  }
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

export default formatDuration;

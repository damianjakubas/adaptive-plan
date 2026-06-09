/**
 * Controlled-input render face for a numeric RHF field whose schema input type
 * is `unknown` (z.preprocess): at runtime the value is either a number — where
 * NaN is the "user typed nothing" face seeded by the plan-day mapper — or the
 * raw string the user is currently typing. Both empty faces render as "".
 */
function asEmptyableNumericValue(value: unknown): number | string {
  if (typeof value === "number") {
    return Number.isNaN(value) ? "" : value;
  }
  return typeof value === "string" ? value : "";
}

export default asEmptyableNumericValue;

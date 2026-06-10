/**
 * Controlled-input render face for a numeric RHF field whose schema input type
 * is `unknown` (z.preprocess): at runtime the value is either a number — where
 * NaN is a defensive "user typed nothing" face a caller may seed — or the raw
 * string the user is currently typing. Both empty faces render as "".
 */
function asEmptyableNumericValue(value: unknown): number | string {
  if (typeof value === "number") {
    return Number.isNaN(value) ? "" : value;
  }
  return typeof value === "string" ? value : "";
}

export default asEmptyableNumericValue;

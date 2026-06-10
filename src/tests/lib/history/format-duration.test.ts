import { describe, expect, it } from "vitest";

import formatDuration from "@/lib/history/format-duration";

/**
 * Oracle: FR-018 / the `historia_trening_w` mockup render durations compactly
 * as `1h 15m` / `45m` / `2h`. Whole hours drop the minutes part; sub-hour
 * durations drop the hours part; zero is still shown as `0m`.
 */
describe("formatDuration", () => {
  it("renders zero minutes as \"0m\" (never an empty string)", () => {
    expect(formatDuration(0)).toBe("0m");
  });

  it("renders a sub-hour duration with only the minutes part", () => {
    expect(formatDuration(45)).toBe("45m");
  });

  it("renders an exact hour without a minutes part", () => {
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(120)).toBe("2h");
  });

  it("renders hours and minutes together", () => {
    expect(formatDuration(75)).toBe("1h 15m");
  });

  it("truncates fractional minutes rather than emitting a decimal", () => {
    expect(formatDuration(75.9)).toBe("1h 15m");
  });

  it("degrades a negative duration (clock skew / bad data) to \"0m\"", () => {
    expect(formatDuration(-10)).toBe("0m");
  });
});

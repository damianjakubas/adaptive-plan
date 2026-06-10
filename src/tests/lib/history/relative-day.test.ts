import { describe, expect, it } from "vitest";

import getRelativeDay from "@/lib/history/relative-day";

/**
 * Oracle: the date column shows a calendar-based relative label —
 * Today / Yesterday / weekday (2–6 days back) / absolute date (≥7 days back or
 * future). Comparison is by calendar date, NOT a rolling 24-hour window, so a
 * late-evening session and the next morning's `now` are still "yesterday" apart
 * by exactly one calendar day. Dates are built from local components to match
 * the helper's local-calendar comparison.
 */

// Reference "now": Wed 2026-06-10, mid-morning.
const now = new Date(2026, 5, 10, 9, 0);

describe("getRelativeDay", () => {
  it("classifies the same calendar date as \"today\" even across a wide time gap", () => {
    expect(getRelativeDay(new Date(2026, 5, 10, 0, 1), now)).toBe("today");
    expect(getRelativeDay(new Date(2026, 5, 10, 23, 59), now)).toBe("today");
  });

  it("classifies 23:59 the previous calendar date as \"yesterday\", not a 24h window", () => {
    // ~9h before `now`, but a different calendar date → yesterday, not today.
    expect(getRelativeDay(new Date(2026, 5, 9, 23, 59), now)).toBe("yesterday");
  });

  it("classifies 2 calendar days back as a weekday label", () => {
    expect(getRelativeDay(new Date(2026, 5, 8, 12, 0), now)).toBe("weekday");
  });

  it("treats exactly 6 days back as a weekday and 7 days back as a plain date", () => {
    expect(getRelativeDay(new Date(2026, 5, 4, 12, 0), now)).toBe("weekday");
    expect(getRelativeDay(new Date(2026, 5, 3, 12, 0), now)).toBe("date");
  });

  it("degrades a future performedAt (clock skew) to \"date\" rather than crashing", () => {
    expect(getRelativeDay(new Date(2026, 5, 11, 9, 0), now)).toBe("date");
  });
});

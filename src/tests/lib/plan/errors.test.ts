import { describe, expect, it } from "vitest";

import { mapPlanError } from "@/lib/plan/errors";

describe("mapPlanError", () => {
  const cases: Array<[string, unknown, string]> = [
    ["statusCode 429 → rate_limited", { statusCode: 429 }, "rate_limited"],
    ["statusCode 500 → generation_failed", { statusCode: 500 }, "generation_failed"],
    ['message "rate limit" → rate_limited', new Error("rate limit exceeded"), "rate_limited"],
    ['message "quota" → rate_limited', new Error("quota exceeded"), "rate_limited"],
    ['message "429" → rate_limited', new Error("provider returned 429"), "rate_limited"],
    ["string with rate-limit keyword → rate_limited", "quota exceeded", "rate_limited"],
    ["plain Error → generation_failed", new Error("unexpected server error"), "generation_failed"],
    ["string input → generation_failed", "something went wrong", "generation_failed"],
    ["plain object → generation_failed", { message: "oops" }, "generation_failed"],
  ];

  it.each(cases)("%s", (_label, input, expected) => {
    expect(mapPlanError(input)).toBe(expected);
  });
});

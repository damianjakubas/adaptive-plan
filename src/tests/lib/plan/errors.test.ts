import { describe, expect, it } from "vitest";

import { mapPlanError } from "@/lib/plan/errors";

describe("mapPlanError", () => {
  const cases: Array<[string, unknown, string]> = [
    ["statusCode 429", { statusCode: 429 }, "rate_limited"],
    ['message "rate limit"', new Error("rate limit exceeded"), "rate_limited"],
    ['message "quota"', new Error("quota exceeded"), "rate_limited"],
    ['message "429"', new Error("provider returned 429"), "rate_limited"],
    ["string with rate-limit keyword", "quota exceeded", "rate_limited"],
    ["plain Error", new Error("unexpected server error"), "generation_failed"],
    ["string input", "something went wrong", "generation_failed"],
    ["plain object", { message: "oops" }, "generation_failed"],
  ];

  it.each(cases)("%s → %s", (_label, input, expected) => {
    expect(mapPlanError(input)).toBe(expected);
  });
});

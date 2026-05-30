import { describe, expect, it } from "vitest";

import { signInSchema, signUpSchema } from "@/lib/validation/auth";

/** Collect the first error message per field from a failed safeParse result. */
function fieldErrors(result: { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } }) {
  const map: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0]);
    if (!(key in map)) {
      map[key] = issue.message;
    }
  }
  return map;
}

describe("signInSchema", () => {
  it("accepts a valid email + non-empty password", () => {
    const result = signInSchema.safeParse({ email: "user@example.com", password: "x" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email with the invalid_email code", () => {
    const result = signInSchema.safeParse({ email: "not-an-email", password: "secret" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result).email).toBe("invalid_email");
    }
  });

  it("rejects an empty password with the password_required code", () => {
    const result = signInSchema.safeParse({ email: "user@example.com", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result).password).toBe("password_required");
    }
  });

  it("rejects missing fields", () => {
    const result = signInSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("accepts a valid email + password of at least 6 characters", () => {
    const result = signUpSchema.safeParse({ email: "user@example.com", password: "secret" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email with the invalid_email code", () => {
    const result = signUpSchema.safeParse({ email: "bad", password: "secret" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result).email).toBe("invalid_email");
    }
  });

  it("rejects a password shorter than 6 characters with the password_too_short code", () => {
    const result = signUpSchema.safeParse({ email: "user@example.com", password: "12345" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result).password).toBe("password_too_short");
    }
  });

  it("rejects missing fields", () => {
    const result = signUpSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

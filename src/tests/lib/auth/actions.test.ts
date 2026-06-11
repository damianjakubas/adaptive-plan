import type { AuthError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fns are declared via vi.hoisted so they exist before the hoisted vi.mock calls run.
const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      signOut: mocks.signOut,
    },
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import { signIn, signOut, signUp } from "@/lib/auth/actions";
import { mapAuthError } from "@/lib/auth/errors";

/** Build a minimal Supabase AuthError-shaped object for tests. */
function authError(partial: Partial<AuthError>): AuthError {
  return { name: "AuthApiError", message: "", status: 400, ...partial } as AuthError;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("signIn", () => {
  it("returns generic when input fails schema validation (no Supabase call)", async () => {
    const result = await signIn({ email: "not-an-email", password: "" });
    expect(result).toEqual({ ok: false, code: "generic" });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("maps a Supabase invalid_credentials error to the invalid_credentials code", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: authError({ code: "invalid_credentials" }),
    });

    const result = await signIn({ email: "user@example.com", password: "secret" });

    expect(result).toEqual({ ok: false, code: "invalid_credentials" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects to /dashboard on success", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });

    await signIn({ email: "user@example.com", password: "secret" });

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "secret",
    });
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });
});

describe("signUp", () => {
  it("returns generic when input fails schema validation (no Supabase call)", async () => {
    const result = await signUp({ email: "user@example.com", password: "123" });
    expect(result).toEqual({ ok: false, code: "generic" });
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("maps a Supabase signup error to its code", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: authError({ code: "weak_password" }),
    });

    const result = await signUp({ email: "user@example.com", password: "secret" });

    expect(result).toEqual({ ok: false, code: "weak_password" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("treats an empty identities array as an already-registered email", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "u1", identities: [] }, session: null },
      error: null,
    });

    const result = await signUp({ email: "taken@example.com", password: "secret" });

    expect(result).toEqual({ ok: false, code: "email_exists" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects to /dashboard on a fresh successful signup", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "u1", identities: [{ id: "i1" }] }, session: {} },
      error: null,
    });

    await signUp({ email: "new@example.com", password: "secret" });

    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });
});

describe("signOut", () => {
  it("calls supabase.auth.signOut and redirects to /login", async () => {
    mocks.signOut.mockResolvedValue({ error: null });

    await signOut();

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });
});

describe("mapAuthError", () => {
  it("maps typed invalid_credentials", () => {
    expect(mapAuthError(authError({ code: "invalid_credentials" }))).toBe("invalid_credentials");
  });

  it("maps user_already_exists and email_exists to email_exists", () => {
    expect(mapAuthError(authError({ code: "user_already_exists" }))).toBe("email_exists");
    expect(mapAuthError(authError({ code: "email_exists" }))).toBe("email_exists");
  });

  it("maps weak_password", () => {
    expect(mapAuthError(authError({ code: "weak_password" }))).toBe("weak_password");
  });

  it("falls back to message heuristics when code is absent", () => {
    expect(mapAuthError(authError({ message: "User already registered" }))).toBe("email_exists");
    expect(mapAuthError(authError({ message: "Invalid login credentials" }))).toBe(
      "invalid_credentials",
    );
    expect(mapAuthError(authError({ message: "Password should be longer" }))).toBe("weak_password");
  });

  it("returns generic for unknown errors", () => {
    expect(mapAuthError(authError({ message: "kaboom" }))).toBe("generic");
  });
});

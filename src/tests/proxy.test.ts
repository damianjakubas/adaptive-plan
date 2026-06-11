import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: updateSessionMock,
}));

import { proxy } from "@/proxy";

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(`http://localhost${pathname}`);
}

function makeSession(user: { id: string } | null, cookies: [string, string][] = []) {
  const response = NextResponse.next();
  cookies.forEach(([name, value]) => response.cookies.set(name, value));
  return { response, user };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("proxy", () => {
  describe("unauthenticated — gated routes", () => {
    beforeEach(() => {
      updateSessionMock.mockResolvedValue(makeSession(null));
    });

    it("redirects /plan to /login with 307", async () => {
      const res = await proxy(makeRequest("/plan"));

      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    });

    it("returns 401 JSON { code: 'unauthenticated' } for /api/plan/generate", async () => {
      const res = await proxy(makeRequest("/api/plan/generate"));

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ code: "unauthenticated" });
    });

    it("denies the unlisted route /profile — proves deny-by-default", async () => {
      const res = await proxy(makeRequest("/profile"));

      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    });
  });

  describe("unauthenticated — public routes", () => {
    beforeEach(() => {
      updateSessionMock.mockResolvedValue(makeSession(null));
    });

    it("passes through / without redirect", async () => {
      const res = await proxy(makeRequest("/"));

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });

    it("passes through /login without redirect", async () => {
      const res = await proxy(makeRequest("/login"));

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });

    it("passes through sub-paths of public routes — /login/callback is public", async () => {
      const res = await proxy(makeRequest("/login/callback"));

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });
  });

  describe("authenticated", () => {
    beforeEach(() => {
      updateSessionMock.mockResolvedValue(makeSession({ id: "user-1" }));
    });

    it("redirects /login to /dashboard with 307", async () => {
      const res = await proxy(makeRequest("/login"));

      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
    });

    it("passes through /plan for an authenticated user", async () => {
      const res = await proxy(makeRequest("/plan"));

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });
  });

  describe("Set-Cookie preservation", () => {
    it("carries session-refresh cookies onto the redirect for gated page /plan", async () => {
      updateSessionMock.mockResolvedValue(makeSession(null, [["sb-refresh-token", "tok-abc"]]));

      const res = await proxy(makeRequest("/plan"));

      expect(res.cookies.get("sb-refresh-token")?.value).toBe("tok-abc");
    });

    it("carries session-refresh cookies onto the 401 response for /api/*", async () => {
      updateSessionMock.mockResolvedValue(makeSession(null, [["sb-refresh-token", "tok-abc"]]));

      const res = await proxy(makeRequest("/api/plan/generate"));

      expect(res.cookies.get("sb-refresh-token")?.value).toBe("tok-abc");
    });
  });
});

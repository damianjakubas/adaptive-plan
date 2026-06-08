import { beforeEach, describe, expect, it, vi } from "vitest";

import { validPlan } from "@/tests/helpers/ai-stub";
import type { StreamTextController } from "@/tests/helpers/ai-stub";

// Hoisted so the vi.mock factories below can reference them before imports resolve.
const ctrl = vi.hoisted((): StreamTextController => ({
  capturedOnFinish: null,
  outputPromise: Promise.resolve<unknown>(null),
  streamText: vi.fn(),
}));

const serverMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  saveActivePlan: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: serverMocks.getUser } })),
}));

vi.mock("@/db/plans", () => ({
  getActivePlan: vi.fn(),
  saveActivePlan: serverMocks.saveActivePlan,
}));

vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(() => "mock-model"),
}));

// The route reads the active UI locale server-side; outside a Next.js request
// scope (vitest) the real implementation throws, so stub it to the default.
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => "pl"),
}));

vi.mock("ai", async () => {
  const { createStreamTextMock } = await import("@/tests/helpers/ai-stub");
  return createStreamTextMock(ctrl);
});

import { POST } from "@/app/api/plan/generate/route";

const validInput = {
  age: 30,
  dailySteps: 6000,
  equipment: "gym",
  experience: "intermediate",
  frequency: 4,
  goal: "muscle",
  healthIssues: "none",
  height: 180,
  sex: "male",
  timePerSession: 60,
  weight: 80,
  workMode: "sedentary",
};

function postRequest(body: unknown, raw = false): Request {
  return new Request("http://localhost/api/plan/generate", {
    body: raw ? (body as string) : JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  ctrl.capturedOnFinish = null;
  ctrl.outputPromise = Promise.resolve(validPlan);
  serverMocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  serverMocks.saveActivePlan.mockResolvedValue({});
});

describe("POST /api/plan/generate", () => {
  it("returns 401 with unauthenticated code when logged out", async () => {
    serverMocks.getUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(postRequest(validInput));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: "unauthenticated" });
    expect(ctrl.streamText).not.toHaveBeenCalled();
    expect(serverMocks.saveActivePlan).not.toHaveBeenCalled();
  });

  it("returns 400 with invalid_parameters code on an invalid body", async () => {
    const res = await POST(postRequest({ ...validInput, weight: 5 }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "invalid_parameters" });
    expect(ctrl.streamText).not.toHaveBeenCalled();
    expect(serverMocks.saveActivePlan).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed JSON", async () => {
    const res = await POST(postRequest("{not json", true));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "invalid_parameters" });
  });

  it("streams on valid input and persists exactly one user-scoped active plan", async () => {
    const res = await POST(postRequest(validInput));

    expect(res.status).toBe(200);
    expect(ctrl.streamText).toHaveBeenCalledTimes(1);

    // onFinish runs after the stream is consumed; drive it explicitly.
    await ctrl.capturedOnFinish?.();

    expect(serverMocks.saveActivePlan).toHaveBeenCalledTimes(1);
    expect(serverMocks.saveActivePlan).toHaveBeenCalledWith({
      model: "gemini-2.5-flash",
      parameters: expect.objectContaining({ goal: "muscle" }),
      plan: validPlan,
      userId: "user-1",
    });
  });

  it("scopes the write to the authenticated user, ignoring any client-supplied id", async () => {
    await POST(postRequest({ ...validInput, userId: "attacker" }));
    await ctrl.capturedOnFinish?.();

    expect(serverMocks.saveActivePlan).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" })
    );
    expect(serverMocks.saveActivePlan.mock.calls[0][0]).not.toHaveProperty("parameters.userId");
  });

  it("does not persist a partial plan when the generated object fails validation", async () => {
    ctrl.outputPromise = Promise.resolve({ summary: "incomplete" });

    await POST(postRequest(validInput));
    await ctrl.capturedOnFinish?.();

    expect(serverMocks.saveActivePlan).not.toHaveBeenCalled();
  });

  it("does not persist when the output promise rejects", async () => {
    ctrl.outputPromise = Promise.reject(new Error("generation failed"));

    await POST(postRequest(validInput));
    await expect(ctrl.capturedOnFinish?.()).resolves.toBeUndefined();

    expect(serverMocks.saveActivePlan).not.toHaveBeenCalled();
  });
});

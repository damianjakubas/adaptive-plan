import { beforeEach, describe, expect, it, vi } from "vitest";

import { planOutputSchema } from "@/lib/validation/plan-schema";
import { validPlan } from "@/tests/helpers/ai-stub";
import type { StreamTextController } from "@/tests/helpers/ai-stub";

// Hoisted so the vi.mock factories below can reference them before imports resolve.
const ctrl = vi.hoisted((): StreamTextController => ({
  capturedOnError: null,
  capturedOnFinish: null,
  capturedOutputObjectSchema: null,
  outputPromise: Promise.resolve<unknown>(null),
  streamText: vi.fn(),
}));

const logMock = vi.hoisted(() => ({ logGenerationError: vi.fn() }));

const serverMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  saveActivePlan: vi.fn(),
}));

vi.mock("@/lib/plan/log-generation-error", () => ({
  logGenerationError: logMock.logGenerationError,
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
  ctrl.streamText.mockReset();
  ctrl.capturedOnError = null;
  ctrl.capturedOnFinish = null;
  ctrl.capturedOutputObjectSchema = null;
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
  // Stryker survivor (equivalent mutant): removing the catch body at line ~50 still
  // returns 400 — `body` becomes undefined, planInputSchema.safeParse(undefined) fails
  // and triggers the same 400 path. No kill needed; behaviour is identical.

  it("streams on valid input and persists exactly one user-scoped active plan", async () => {
    const res = await POST(postRequest(validInput));

    expect(res.status).toBe(200);
    expect(ctrl.streamText).toHaveBeenCalledTimes(1);

    // onFinish runs after the stream is consumed; drive it explicitly.
    await ctrl.capturedOnFinish?.();

    expect(serverMocks.saveActivePlan).toHaveBeenCalledTimes(1);
    expect(serverMocks.saveActivePlan).toHaveBeenCalledWith({
      model: "gemini-3.5-flash",
      parameters: expect.objectContaining({ goal: "muscle" }),
      plan: validPlan,
      userId: "user-1",
    });
    expect(logMock.logGenerationError).not.toHaveBeenCalled();
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
    expect(logMock.logGenerationError).toHaveBeenCalledTimes(1);
  });

  // Stryker survivors (consciously ignored):
  //   - BlockStatement: emptying the output-catch body still prevents persistence because
  //     `generated` stays undefined and safeParse(undefined) fails — equivalent mutant.
  //   - ObjectLiteral / StringLiteral on all logGenerationError calls: blanking the
  //     `stage` label or stripping args is observability-only; no user or business impact.
  //     Killing them requires asserting internal telemetry strings — a mirror-test pattern.
  it("does not persist when the output promise rejects", async () => {
    ctrl.outputPromise = Promise.reject(new Error("generation failed"));

    await POST(postRequest(validInput));
    await expect(ctrl.capturedOnFinish?.()).resolves.toBeUndefined();

    expect(serverMocks.saveActivePlan).not.toHaveBeenCalled();
    expect(logMock.logGenerationError).toHaveBeenCalledTimes(1);
  });

  it("does not persist when the generated output is empty {}", async () => {
    ctrl.outputPromise = Promise.resolve({});

    await POST(postRequest(validInput));
    await ctrl.capturedOnFinish?.();

    expect(serverMocks.saveActivePlan).not.toHaveBeenCalled();
    expect(logMock.logGenerationError).toHaveBeenCalledTimes(1);
  });

  it("does not persist when the generated output is null", async () => {
    ctrl.outputPromise = Promise.resolve(null);

    await POST(postRequest(validInput));
    await ctrl.capturedOnFinish?.();

    expect(serverMocks.saveActivePlan).not.toHaveBeenCalled();
    expect(logMock.logGenerationError).toHaveBeenCalledTimes(1);
  });

  it("catches saveActivePlan throw, does not crash, does not persist, logs once", async () => {
    serverMocks.saveActivePlan.mockRejectedValue(new Error("DB error"));

    await POST(postRequest(validInput));
    await expect(ctrl.capturedOnFinish?.()).resolves.toBeUndefined();

    expect(serverMocks.saveActivePlan).toHaveBeenCalledTimes(1);
    expect(logMock.logGenerationError).toHaveBeenCalledTimes(1);
  });

  it("returns 500 with mapped error code and logs once on synchronous streamText throw", async () => {
    ctrl.streamText.mockImplementation(() => {
      throw new Error("model unavailable");
    });

    const res = await POST(postRequest(validInput));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ code: "generation_failed" });
    expect(logMock.logGenerationError).toHaveBeenCalledTimes(1);
  });

  it("returns 500 with rate_limited code when streamText throws a 429 error", async () => {
    const rateLimitError = Object.assign(new Error("quota exceeded"), { statusCode: 429 });
    ctrl.streamText.mockImplementation(() => {
      throw rateLimitError;
    });

    const res = await POST(postRequest(validInput));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ code: "rate_limited" });
    expect(logMock.logGenerationError).toHaveBeenCalledTimes(1);
  });

  it("fires logGenerationError once via onError on a stream transport error", async () => {
    await POST(postRequest(validInput));
    ctrl.capturedOnError?.({ error: new Error("transport failure") });

    expect(logMock.logGenerationError).toHaveBeenCalledTimes(1);
    expect(logMock.logGenerationError).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "stream" })
    );
  });

  // Oracle: plan-schema.ts declares planOutputSchema as "single source of truth...
  // imported by both the generation route (Output.object) and the streaming client
  // (useObject)". Without the schema, the AI SDK generates unstructured output,
  // breaking the client's streaming contract for every user (US-01).
  it("passes planOutputSchema as the structured-output schema to the AI SDK", async () => {
    await POST(postRequest(validInput));

    expect(ctrl.capturedOutputObjectSchema).toBe(planOutputSchema);
  });
});

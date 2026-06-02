import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GeneratedPlan } from "@/lib/validation/plan-schema";

// Hoisted so the vi.mock factories below can reference them.
const mocks = vi.hoisted(() => ({
  capturedOnFinish: null as null | (() => Promise<void>),
  getUser: vi.fn(),
  outputPromise: Promise.resolve<unknown>(null),
  saveActivePlan: vi.fn(),
  streamText: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));

vi.mock("@/db/plans", () => ({
  getActivePlan: vi.fn(),
  saveActivePlan: mocks.saveActivePlan,
}));

vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(() => "mock-model"),
}));

vi.mock("ai", () => ({
  Output: { object: vi.fn(() => ({})) },
  streamText: (opts: { onFinish: () => Promise<void> }) => {
    mocks.streamText(opts);
    mocks.capturedOnFinish = opts.onFinish;
    return {
      output: mocks.outputPromise,
      toTextStreamResponse: () => new Response("stream", { status: 200 }),
    };
  },
}));

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

const validPlan: GeneratedPlan = {
  calorieTarget: { kcal: 2400, note: "surplus" },
  cardioGoal: { note: "zone 2", targetMinutes: 90 },
  dietaryTips: [{ body: "across meals", title: "Protein" }],
  disclaimer: "Not medical advice.",
  goal: "Build muscle",
  milestones: ["Week 4: +2kg"],
  progression: ["Add reps weekly"],
  summary: "A 4-day split.",
  timelineWeeks: 12,
  weeklySchedule: [
    { day: "Monday", exercises: [{ name: "Bench press", reps: "8-12", sets: 4 }], focus: "Upper", isRest: false },
  ],
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
  mocks.capturedOnFinish = null;
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mocks.saveActivePlan.mockResolvedValue({});
  mocks.outputPromise = Promise.resolve(validPlan);
});

describe("POST /api/plan/generate", () => {
  it("returns 401 with unauthenticated code when logged out", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(postRequest(validInput));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: "unauthenticated" });
    expect(mocks.streamText).not.toHaveBeenCalled();
    expect(mocks.saveActivePlan).not.toHaveBeenCalled();
  });

  it("returns 400 with invalid_parameters code on an invalid body", async () => {
    const res = await POST(postRequest({ ...validInput, weight: 5 }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "invalid_parameters" });
    expect(mocks.streamText).not.toHaveBeenCalled();
    expect(mocks.saveActivePlan).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed JSON", async () => {
    const res = await POST(postRequest("{not json", true));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "invalid_parameters" });
  });

  it("streams on valid input and persists exactly one user-scoped active plan", async () => {
    const res = await POST(postRequest(validInput));

    expect(res.status).toBe(200);
    expect(mocks.streamText).toHaveBeenCalledTimes(1);

    // onFinish runs after the stream is consumed; drive it explicitly.
    await mocks.capturedOnFinish?.();

    expect(mocks.saveActivePlan).toHaveBeenCalledTimes(1);
    expect(mocks.saveActivePlan).toHaveBeenCalledWith({
      model: "gemini-2.5-flash",
      parameters: expect.objectContaining({ goal: "muscle" }),
      plan: validPlan,
      userId: "user-1",
    });
  });

  it("scopes the write to the authenticated user, ignoring any client-supplied id", async () => {
    await POST(postRequest({ ...validInput, userId: "attacker" }));
    await mocks.capturedOnFinish?.();

    expect(mocks.saveActivePlan).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" })
    );
    expect(mocks.saveActivePlan.mock.calls[0][0]).not.toHaveProperty("parameters.userId");
  });

  it("does not persist a partial plan when the generated object fails validation", async () => {
    mocks.outputPromise = Promise.resolve({ summary: "incomplete" });

    await POST(postRequest(validInput));
    await mocks.capturedOnFinish?.();

    expect(mocks.saveActivePlan).not.toHaveBeenCalled();
  });

  it("does not persist when the output promise rejects", async () => {
    mocks.outputPromise = Promise.reject(new Error("generation failed"));

    await POST(postRequest(validInput));
    await expect(mocks.capturedOnFinish?.()).resolves.toBeUndefined();

    expect(mocks.saveActivePlan).not.toHaveBeenCalled();
  });
});

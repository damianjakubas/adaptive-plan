import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fns are declared via vi.hoisted so they exist before the hoisted vi.mock calls run.
const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  getActivePlan: vi.fn(),
  getUser: vi.fn(),
  logWorkoutError: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
  })),
}));

vi.mock("@/db/plans", () => ({
  getActivePlan: mocks.getActivePlan,
}));

vi.mock("@/db/workout-sessions", () => ({
  createSession: mocks.createSession,
}));

vi.mock("@/lib/workout/log-workout-error", () => ({
  logWorkoutError: mocks.logWorkoutError,
}));

import { type WorkoutSessionFormValues } from "@/lib/validation/workout-session-form-schema";
import { saveWorkoutSession } from "@/lib/workout/actions";

/**
 * Hermetic contract tests for the save action's branches (gating rule 3, FR-016).
 * The store's real-DB persistence is already integration-tested in F-01
 * (`src/tests/db/workout-sessions.test.ts`) — these pin the branches real infra
 * can't cheaply trigger: auth, gating, stamping, and the persistence-failure path.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PLAN_ID = "22222222-2222-4222-8222-222222222222";

const validValues: WorkoutSessionFormValues = {
  durationMinutes: 60,
  exercises: [
    {
      muscleGroup: "chest",
      name: "Bench press",
      sets: [
        { reps: "10", weight: 60 },
        { reps: "8-12", weight: undefined },
      ],
    },
  ],
  note: "felt strong",
  sessionName: "Upper body",
  sessionType: "Monday",
};

function authenticatedUser(): void {
  mocks.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveWorkoutSession", () => {
  it("returns unauthenticated when no user session exists (no plan lookup, no write)", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await saveWorkoutSession(validValues);

    expect(result).toEqual({ ok: false, code: "unauthenticated" });
    expect(mocks.getActivePlan).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("returns no_active_plan when the gating re-check finds no active plan (no write)", async () => {
    authenticatedUser();
    mocks.getActivePlan.mockResolvedValue(null);

    const result = await saveWorkoutSession(validValues);

    expect(result).toEqual({ ok: false, code: "no_active_plan" });
    expect(mocks.getActivePlan).toHaveBeenCalledWith(USER_ID);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("returns invalid_input for a payload the write schema rejects (zero exercises, no write)", async () => {
    authenticatedUser();
    mocks.getActivePlan.mockResolvedValue({ id: PLAN_ID });

    const result = await saveWorkoutSession({ ...validValues, exercises: [] });

    expect(result).toEqual({ ok: false, code: "invalid_input" });
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("stamps userId, sourcePlanId, and a server-clock performedAt on the happy path", async () => {
    authenticatedUser();
    mocks.getActivePlan.mockResolvedValue({ id: PLAN_ID });
    mocks.createSession.mockResolvedValue("new-session-id");

    const before = Date.now();
    const result = await saveWorkoutSession(validValues);
    const after = Date.now();

    expect(result).toEqual({ ok: true });
    expect(mocks.createSession).toHaveBeenCalledTimes(1);

    const input = mocks.createSession.mock.calls[0][0];
    expect(input).toMatchObject({
      durationMinutes: 60,
      sessionName: "Upper body",
      sourcePlanId: PLAN_ID,
      userId: USER_ID,
    });
    expect(input.exercises).toEqual(validValues.exercises);
    expect(input.performedAt).toBeInstanceOf(Date);
    expect(input.performedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(input.performedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it("returns save_failed and logs the error when createSession rejects", async () => {
    authenticatedUser();
    mocks.getActivePlan.mockResolvedValue({ id: PLAN_ID });
    mocks.createSession.mockRejectedValue(new Error("db down"));

    const result = await saveWorkoutSession(validValues);

    expect(result).toEqual({ ok: false, code: "save_failed" });
    expect(mocks.logWorkoutError).toHaveBeenCalledTimes(1);
  });
});

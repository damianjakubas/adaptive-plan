import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fns are declared via vi.hoisted so they exist before the hoisted vi.mock calls run.
const mocks = vi.hoisted(() => ({
  createSession: vi.fn<(input: CreateSessionInput) => Promise<string>>(),
  deleteSession: vi.fn<(userId: string, sessionId: string) => Promise<boolean>>(),
  getActivePlan: vi.fn(),
  getSessionById: vi.fn(),
  getUser: vi.fn(),
  logWorkoutError: vi.fn(),
  updateSession: vi.fn<
    (userId: string, sessionId: string, input: WorkoutSessionInput) => Promise<boolean>
  >(),
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
  deleteSession: mocks.deleteSession,
  getSessionById: mocks.getSessionById,
  updateSession: mocks.updateSession,
}));

vi.mock("@/lib/workout/log-workout-error", () => ({
  logWorkoutError: mocks.logWorkoutError,
}));

import { type CreateSessionInput } from "@/db/workout-sessions";
import { type WorkoutSessionFormValues } from "@/lib/validation/workout-session-form-schema";
import { type WorkoutSessionInput } from "@/lib/validation/workout-session-schema";
import {
  deleteWorkoutSession,
  saveWorkoutSession,
  updateWorkoutSession,
} from "@/lib/workout/actions";

/**
 * Hermetic contract tests for the save action's branches (gating rule 3, FR-016).
 * The store's real-DB persistence is already integration-tested in F-01
 * (`src/tests/db/workout-sessions.test.ts`) — these pin the branches real infra
 * can't cheaply trigger: auth, gating, stamping, and the persistence-failure path.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PLAN_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";
// Distinct from PLAN_ID so the preservation assertion proves provenance is read
// from the stored session, not from any active-plan lookup or the editor input.
const ORIGINAL_SOURCE_PLAN_ID = "44444444-4444-4444-8444-444444444444";
const ORIGINAL_PERFORMED_AT = new Date("2026-06-07T09:30:00.000Z");

/** A stored session as `getSessionById` returns it — only the fields the update action reads matter. */
function storedSession(): { performedAt: Date; sourcePlanId: string | null } {
  return { performedAt: ORIGINAL_PERFORMED_AT, sourcePlanId: ORIGINAL_SOURCE_PLAN_ID };
}

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

  it("returns save_failed and logs the error when the active-plan gating read throws", async () => {
    authenticatedUser();
    mocks.getActivePlan.mockRejectedValue(new Error("db down"));

    const result = await saveWorkoutSession(validValues);

    expect(result).toEqual({ ok: false, code: "save_failed" });
    expect(mocks.logWorkoutError).toHaveBeenCalledTimes(1);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
});

/**
 * Hermetic contract tests for the edit action (FR-020). The load-bearing branch
 * is preservation: the original `performedAt` + `sourcePlanId` must survive the
 * edit untouched (FR-024), and edit must NOT re-check the active plan.
 */
describe("updateWorkoutSession", () => {
  it("returns unauthenticated when no user session exists (no load, no write)", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await updateWorkoutSession(SESSION_ID, validValues);

    expect(result).toEqual({ ok: false, code: "unauthenticated" });
    expect(mocks.getSessionById).not.toHaveBeenCalled();
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });

  it("returns not_found when the session is missing or not owned (no write)", async () => {
    authenticatedUser();
    mocks.getSessionById.mockResolvedValue(null);

    const result = await updateWorkoutSession(SESSION_ID, validValues);

    expect(result).toEqual({ ok: false, code: "not_found" });
    expect(mocks.getSessionById).toHaveBeenCalledWith(USER_ID, SESSION_ID);
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });

  it("preserves the original performedAt and sourcePlanId, never re-stamping from the editor or now", async () => {
    authenticatedUser();
    mocks.getSessionById.mockResolvedValue(storedSession());
    mocks.updateSession.mockResolvedValue(true);

    const result = await updateWorkoutSession(SESSION_ID, validValues);

    expect(result).toEqual({ ok: true });
    expect(mocks.updateSession).toHaveBeenCalledTimes(1);

    const [userId, sessionId, input] = mocks.updateSession.mock.calls[0];
    expect(userId).toBe(USER_ID);
    expect(sessionId).toBe(SESSION_ID);
    expect(input.performedAt).toEqual(ORIGINAL_PERFORMED_AT);
    expect(input.sourcePlanId).toBe(ORIGINAL_SOURCE_PLAN_ID);
    // The editor never surfaces these fields — they must come from the stored row only.
    expect(input).toMatchObject({ durationMinutes: 60, sessionName: "Upper body" });
    // Edit must not gate on an active plan (FR-020).
    expect(mocks.getActivePlan).not.toHaveBeenCalled();
  });

  it("returns invalid_input for a payload the write schema rejects (no write)", async () => {
    authenticatedUser();
    mocks.getSessionById.mockResolvedValue(storedSession());

    const result = await updateWorkoutSession(SESSION_ID, { ...validValues, exercises: [] });

    expect(result).toEqual({ ok: false, code: "invalid_input" });
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });

  it("returns not_found when updateSession reports the session is not owned", async () => {
    authenticatedUser();
    mocks.getSessionById.mockResolvedValue(storedSession());
    mocks.updateSession.mockResolvedValue(false);

    const result = await updateWorkoutSession(SESSION_ID, validValues);

    expect(result).toEqual({ ok: false, code: "not_found" });
  });

  it("returns save_failed and logs the error when updateSession rejects", async () => {
    authenticatedUser();
    mocks.getSessionById.mockResolvedValue(storedSession());
    mocks.updateSession.mockRejectedValue(new Error("db down"));

    const result = await updateWorkoutSession(SESSION_ID, validValues);

    expect(result).toEqual({ ok: false, code: "save_failed" });
    expect(mocks.logWorkoutError).toHaveBeenCalledTimes(1);
  });

  it("returns save_failed and logs the error when loading the session rejects", async () => {
    authenticatedUser();
    mocks.getSessionById.mockRejectedValue(new Error("db down"));

    const result = await updateWorkoutSession(SESSION_ID, validValues);

    expect(result).toEqual({ ok: false, code: "save_failed" });
    expect(mocks.logWorkoutError).toHaveBeenCalledTimes(1);
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });
});

/**
 * Hermetic contract tests for the delete action (FR-021). Permanence is the
 * data layer's job (integration-tested in F-01); these pin auth, ownership, and
 * the persistence-failure branch.
 */
describe("deleteWorkoutSession", () => {
  it("returns unauthenticated when no user session exists (no delete)", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await deleteWorkoutSession(SESSION_ID);

    expect(result).toEqual({ ok: false, code: "unauthenticated" });
    expect(mocks.deleteSession).not.toHaveBeenCalled();
  });

  it("returns not_found when the session is missing or not owned", async () => {
    authenticatedUser();
    mocks.deleteSession.mockResolvedValue(false);

    const result = await deleteWorkoutSession(SESSION_ID);

    expect(result).toEqual({ ok: false, code: "not_found" });
    expect(mocks.deleteSession).toHaveBeenCalledWith(USER_ID, SESSION_ID);
  });

  it("returns ok when the owned session is deleted", async () => {
    authenticatedUser();
    mocks.deleteSession.mockResolvedValue(true);

    const result = await deleteWorkoutSession(SESSION_ID);

    expect(result).toEqual({ ok: true });
  });

  it("returns delete_failed and logs the error when deleteSession rejects", async () => {
    authenticatedUser();
    mocks.deleteSession.mockRejectedValue(new Error("db down"));

    const result = await deleteWorkoutSession(SESSION_ID);

    expect(result).toEqual({ ok: false, code: "delete_failed" });
    expect(mocks.logWorkoutError).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it } from "vitest";

import type { SessionWithTree } from "@/db/workout-sessions";
import mapSessionToFormValues from "@/lib/workout/map-session-to-form-values";

/**
 * Oracle: FR-020 — editing a saved session reopens it in the same logging editor,
 * pre-filled with its stored data. The mapper is the mirror of
 * `mapPlanDayToFormValues`: it must turn the persisted tree (numeric duration,
 * nullable weight/note/muscleGroup/sessionType, ordered exercises and sets) back
 * into the form's `z.input` shape (strings, `undefined` for absent optionals),
 * and must drop `performedAt`/`sourcePlanId` since the editor never surfaces them
 * (they are preserved server-side in the update action).
 */

const session: SessionWithTree = {
  createdAt: new Date("2026-06-01T09:00:00.000Z"),
  durationMinutes: 60,
  exercises: [
    {
      id: "ex-1",
      muscleGroup: "chest",
      name: "Bench press",
      note: "controlled tempo",
      position: 0,
      sessionId: "session-1",
      sets: [
        { exerciseId: "ex-1", id: "set-1", note: "warmup", position: 0, reps: "12", weight: 40 },
        { exerciseId: "ex-1", id: "set-2", note: null, position: 1, reps: "10", weight: 50 },
      ],
    },
    {
      id: "ex-2",
      muscleGroup: null,
      name: "Plank",
      note: null,
      position: 1,
      sessionId: "session-1",
      sets: [
        { exerciseId: "ex-2", id: "set-3", note: null, position: 0, reps: "30s", weight: null },
      ],
    },
  ],
  id: "session-1",
  note: "felt strong",
  performedAt: new Date("2026-06-07T18:30:00.000Z"),
  sessionName: "Upper body",
  sessionType: "Monday",
  sourcePlanId: "plan-1",
  userId: "user-1",
};

describe("mapSessionToFormValues", () => {
  it("coerces the numeric durationMinutes back to the string the number input round-trips", () => {
    const values = mapSessionToFormValues(session);

    expect(values.durationMinutes).toBe("60");
  });

  it("carries sessionName, the session note, and the nullable sessionType through", () => {
    const values = mapSessionToFormValues(session);

    expect(values.sessionName).toBe("Upper body");
    expect(values.note).toBe("felt strong");
    expect(values.sessionType).toBe("Monday");
  });

  it("maps a null sessionType and null session note to undefined (form optionals, never null)", () => {
    const values = mapSessionToFormValues({ ...session, note: null, sessionType: null });

    expect(values.sessionType).toBeUndefined();
    expect(values.note).toBeUndefined();
  });

  it("preserves exercise order and copies name, muscleGroup, and note (null → undefined)", () => {
    const values = mapSessionToFormValues(session);

    expect(values.exercises[0]).toMatchObject({
      muscleGroup: "chest",
      name: "Bench press",
      note: "controlled tempo",
    });
    expect(values.exercises[1]).toMatchObject({
      muscleGroup: undefined,
      name: "Plank",
      note: undefined,
    });
  });

  it("preserves set order and maps reps through, with null weight → undefined and null note → undefined", () => {
    const values = mapSessionToFormValues(session);

    expect(values.exercises[0].sets).toEqual([
      { note: "warmup", reps: "12", weight: 40 },
      { note: undefined, reps: "10", weight: 50 },
    ]);
    expect(values.exercises[1].sets).toEqual([
      { note: undefined, reps: "30s", weight: undefined },
    ]);
  });

  it("drops performedAt and sourcePlanId — the editor never surfaces them", () => {
    const values = mapSessionToFormValues(session);

    expect(values).not.toHaveProperty("performedAt");
    expect(values).not.toHaveProperty("sourcePlanId");
  });

  it("maps a session with no exercises to an empty list instead of throwing", () => {
    const values = mapSessionToFormValues({ ...session, exercises: [] });

    expect(values.exercises).toEqual([]);
  });
});

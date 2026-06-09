import { vi } from "vitest";

import type { GeneratedPlan } from "@/lib/validation/plan-schema";

// Returns the stubbed `ai` module. Pass the vi.hoisted controller so that
// mutations in beforeEach propagate — the returned streamText closure reads
// ctrl properties lazily (at call time), not at factory-call time.
export function createStreamTextMock(ctrl: StreamTextController) {
  return {
    Output: {
      object: vi.fn((opts: { schema?: unknown }) => {
        ctrl.capturedOutputObjectSchema = opts?.schema ?? null;
        return {};
      }),
    },
    streamText: (opts: {
      onError?: (event: { error: unknown }) => void;
      onFinish: () => Promise<void>;
    }) => {
      ctrl.streamText(opts);
      ctrl.capturedOnError = opts.onError ?? null;
      ctrl.capturedOnFinish = opts.onFinish;
      return {
        output: ctrl.outputPromise,
        toTextStreamResponse: () => new Response("stream", { status: 200 }),
      };
    },
  };
}

// Returns the stubbed `@ai-sdk/react` module. Same lazy-read pattern.
export function createUseObjectMock(ctrl: UseObjectController) {
  return {
    experimental_useObject: ({
      api,
      onFinish,
    }: {
      api: string;
      onFinish: (event: FinishEvent) => void;
    }) => {
      ctrl.capturedApi = api;
      ctrl.capturedOnFinish = onFinish;
      return {
        error: ctrl.error,
        isLoading: ctrl.isLoading,
        object: ctrl.object,
        submit: ctrl.submit,
      };
    },
  };
}

// Canonical valid-plan fixture shared across both seam suites.
export const validPlan: GeneratedPlan = {
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
    {
      day: "Monday",
      exercises: [{ name: "Bench press", reps: "8-12", sets: 4 }],
      focus: "Upper",
      isRest: false,
    },
  ],
};

// Schema-violating object (missing required fields) — used in Phase 2+ tests.
export const schemaViolatingPlan = { summary: "incomplete" };

// Controller shapes — instantiate these in vi.hoisted in each consuming test.
export type StreamTextController = {
  capturedOnError: ((event: { error: unknown }) => void) | null;
  capturedOnFinish: null | (() => Promise<void>);
  capturedOutputObjectSchema: unknown;
  outputPromise: Promise<unknown>;
  streamText: ReturnType<typeof vi.fn>;
};

type FinishEvent = { error: Error | undefined; object: GeneratedPlan | undefined };

export type UseObjectController = {
  capturedApi: string | undefined;
  capturedOnFinish: ((event: FinishEvent) => void) | undefined;
  error: Error | undefined;
  isLoading: boolean;
  object: GeneratedPlan | undefined;
  submit: ReturnType<typeof vi.fn>;
};

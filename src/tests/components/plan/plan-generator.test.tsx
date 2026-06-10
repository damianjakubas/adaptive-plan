import { NextIntlClientProvider } from "next-intl";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UseObjectController } from "@/tests/helpers/ai-stub";
import type { GeneratedPlan } from "@/lib/validation/plan-schema";

// Hoisted so the vi.mock factory below can reference it before imports resolve.
const useObjectCtrl = vi.hoisted((): UseObjectController => ({
  capturedApi: undefined,
  capturedOnFinish: undefined,
  error: undefined,
  isLoading: false,
  object: undefined,
  submit: vi.fn(),
}));

vi.mock("@ai-sdk/react", async () => {
  const { createUseObjectMock } = await import("@/tests/helpers/ai-stub");
  return createUseObjectMock(useObjectCtrl);
});

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

// The component calls useRouter().refresh() on generation success (re-renders the
// (app) layout so the navbar's plan-state updates); vitest mounts no app router.
const mockRefresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

import PlanGenerator from "@/components/plan/plan-generator";
import enMessages from "@/i18n/messages/en.json";

// Component-specific fixture with text strings asserted in UI tests.
const fixture: GeneratedPlan = {
  calorieTarget: { kcal: 2200, note: "Maintain a moderate deficit." },
  cardioGoal: { note: "Steady-state cardio.", targetMinutes: 150 },
  dietaryTips: [{ body: "Eat protein before training.", title: "Pre-workout protein" }],
  disclaimer: "This is not medical advice — fixture text.",
  goal: "Weight Loss",
  milestones: ["Lose 2kg in month one."],
  progression: ["Week 1: establish baseline."],
  summary: "Personalized AI summary for the fixture user.",
  timelineWeeks: 12,
  weeklySchedule: [
    {
      day: "Mon",
      exercises: [{ muscleGroup: "Chest", name: "Bench Press", reps: "8-10", sets: 4 }],
      focus: "Upper Strength",
      isRest: false,
    },
  ],
};

function renderGenerator() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <PlanGenerator />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  useObjectCtrl.capturedApi = undefined;
  useObjectCtrl.capturedOnFinish = undefined;
  useObjectCtrl.error = undefined;
  useObjectCtrl.isLoading = false;
  useObjectCtrl.object = undefined;
  useObjectCtrl.submit.mockClear();
  toastError.mockClear();
  mockRefresh.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PlanGenerator", () => {
  it("shows the abstract loader while the stream is loading", () => {
    useObjectCtrl.isLoading = true;
    renderGenerator();

    expect(screen.getByText(enMessages.Plan.loaderTitle)).toBeInTheDocument();
    // The wizard is not mounted during loading.
    expect(screen.queryByText(enMessages.Plan.next)).not.toBeInTheDocument();
  });

  it("renders the plan view from the final object on finish (no navigation)", () => {
    renderGenerator();

    // Idle: the wizard is shown.
    expect(screen.getByText(enMessages.Plan.next)).toBeInTheDocument();

    // Simulate the stream finishing with a complete, schema-valid object.
    act(() => {
      useObjectCtrl.capturedOnFinish?.({ error: undefined, object: fixture });
    });

    expect(screen.getByText(fixture.summary)).toBeInTheDocument();
    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    // The wizard is replaced by the result view.
    expect(screen.queryByText(enMessages.Plan.next)).not.toBeInTheDocument();
    // The (app) layout is refreshed so the navbar's "Log Workout" entry enables.
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("maps a stream error to a localized toast while keeping the form", () => {
    useObjectCtrl.error = new Error("boom");
    renderGenerator();

    expect(toastError).toHaveBeenCalledWith(enMessages.PlanErrors.generation_failed);
    expect(toastError).toHaveBeenCalledTimes(1);
    // The form remains in place for retry with inputs preserved.
    expect(screen.getByText(enMessages.Plan.next)).toBeInTheDocument();
  });

  it("fires a toast and keeps the form when onFinish delivers no valid object (schema-validation failure)", () => {
    renderGenerator();

    act(() => {
      useObjectCtrl.capturedOnFinish?.({ error: new Error("Output validation failed"), object: undefined });
    });

    expect(toastError).toHaveBeenCalledWith(enMessages.PlanErrors.generation_failed);
    expect(toastError).toHaveBeenCalledTimes(1);
    // Form is shown — not a spinner-forever state.
    expect(screen.getByText(enMessages.Plan.next)).toBeInTheDocument();
    expect(screen.queryByText(enMessages.Plan.loaderTitle)).not.toBeInTheDocument();
  });

  it("does not show the loader when isLoading is false and a terminal transport error is set (no spinner-forever)", () => {
    useObjectCtrl.isLoading = false;
    useObjectCtrl.error = new Error("network failure");
    renderGenerator();

    expect(screen.queryByText(enMessages.Plan.loaderTitle)).not.toBeInTheDocument();
    expect(screen.getByText(enMessages.Plan.next)).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith(enMessages.PlanErrors.generation_failed);
  });

  /*
   * GAP PIN — unhandled hung-stream face.
   *
   * A 200-OK stream that opens but never delivers bytes and never closes leaves
   * isLoading stuck true indefinitely. experimental_useObject only flips isLoading
   * false in its stream close() callback or catch; a hung-but-open stream reaches
   * neither. The client has no AbortController, no stop() call, and no timer —
   * there is no exit path from this state.
   *
   * This test pins CURRENT (gap) behavior: loader visible, wizard absent, no toast.
   * Do NOT read this as a passing recovery path — the hung-stream face is unhandled.
   * A future fix (client-side timeout / abort wiring) must make this test fail
   * before replacing it with a recovery assertion.
   *
   * Contrast with the terminal-error test above (isLoading=false + synchronous error):
   * that test covers a stream that ended with a network error; this test covers a
   * stream that is still nominally open and will never resolve.
   *
   * Cross-reference: residual-risk register — test-plan §6.6 Phase 3, Risk #4.
   */
  it("leaves the loader indefinitely with no toast when the stream is open but never completes (hung-stream gap pin)", () => {
    useObjectCtrl.isLoading = true;
    useObjectCtrl.error = undefined;
    useObjectCtrl.object = undefined;
    // capturedOnFinish is never invoked — stream hangs open.
    renderGenerator();

    expect(screen.getByText(enMessages.Plan.loaderTitle)).toBeInTheDocument();
    expect(screen.queryByText(enMessages.Plan.next)).not.toBeInTheDocument();
    // Silent gap: no toast is shown, the user sees a spinner forever.
    expect(toastError).not.toHaveBeenCalled();
  });

  it("fires a toast when error arrives after initial render (late transport failure)", () => {
    const { rerender } = renderGenerator();
    expect(toastError).not.toHaveBeenCalled();

    useObjectCtrl.error = new Error("late transport failure");
    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <PlanGenerator />
      </NextIntlClientProvider>,
    );

    expect(toastError).toHaveBeenCalledWith(enMessages.PlanErrors.generation_failed);
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("shows the loader AND fires a toast when isLoading and error are both set simultaneously", () => {
    // The render switch checks isLoading before the form fallback, so the loader wins.
    // The error useEffect fires unconditionally regardless of isLoading.
    // This pins current composite behavior so a future early-return-on-error refactor is visible.
    useObjectCtrl.isLoading = true;
    useObjectCtrl.error = new Error("mid-stream transport failure");
    renderGenerator();

    expect(screen.getByText(enMessages.Plan.loaderTitle)).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith(enMessages.PlanErrors.generation_failed);
  });

  // Oracle: US-01 generation flow — the hook must POST to the server-side generation
  // route. A wrong or empty api string routes all generation requests to the wrong URL,
  // causing every plan generation to fail silently for every user.
  it("wires useObject to the plan generation endpoint", () => {
    renderGenerator();

    expect(useObjectCtrl.capturedApi).toBe("/api/plan/generate");
  });

  // Stryker NoCoverage (consciously ignored): the onGenerate callback body
  // (setSubmittedValues + submit) has no coverage because the ParameterForm is a
  // deep child requiring full form-submission simulation — out of scope for this
  // mutation phase. The submit call is covered by integration/e2e layers.
});


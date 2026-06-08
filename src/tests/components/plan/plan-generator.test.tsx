import { NextIntlClientProvider } from "next-intl";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UseObjectController } from "@/tests/helpers/ai-stub";
import type { GeneratedPlan } from "@/lib/validation/plan-schema";

// Hoisted so the vi.mock factory below can reference it before imports resolve.
const useObjectCtrl = vi.hoisted((): UseObjectController => ({
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
  useObjectCtrl.capturedOnFinish = undefined;
  useObjectCtrl.error = undefined;
  useObjectCtrl.isLoading = false;
  useObjectCtrl.object = undefined;
  useObjectCtrl.submit.mockClear();
  toastError.mockClear();
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
  });

  it("maps a stream error to a localized toast while keeping the form", () => {
    useObjectCtrl.error = new Error("boom");
    renderGenerator();

    expect(toastError).toHaveBeenCalledWith(enMessages.PlanErrors.generation_failed);
    // The form remains in place for retry with inputs preserved.
    expect(screen.getByText(enMessages.Plan.next)).toBeInTheDocument();
  });
});

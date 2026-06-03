import { NextIntlClientProvider } from "next-intl";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GeneratedPlan } from "@/lib/validation/plan-schema";

// --- Mocks ----------------------------------------------------------------
// Control `experimental_useObject`'s return value per render and capture the
// `onFinish` callback so the test can drive the "stream finished" transition.
type FinishEvent = { error: Error | undefined; object: GeneratedPlan | undefined };

const submitMock = vi.fn();
const mockState: { error: Error | undefined; isLoading: boolean } = {
  error: undefined,
  isLoading: false,
};
let capturedOnFinish: ((event: FinishEvent) => void) | undefined;

vi.mock("@ai-sdk/react", () => ({
  experimental_useObject: ({ onFinish }: { onFinish: (event: FinishEvent) => void }) => {
    capturedOnFinish = onFinish;
    return { error: mockState.error, isLoading: mockState.isLoading, object: undefined, submit: submitMock };
  },
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

import PlanGenerator from "@/components/plan/plan-generator";
import enMessages from "@/i18n/messages/en.json";

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
  mockState.error = undefined;
  mockState.isLoading = false;
  capturedOnFinish = undefined;
  submitMock.mockClear();
  toastError.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PlanGenerator", () => {
  it("shows the abstract loader while the stream is loading", () => {
    mockState.isLoading = true;
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
      capturedOnFinish?.({ error: undefined, object: fixture });
    });

    expect(screen.getByText(fixture.summary)).toBeInTheDocument();
    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    // The wizard is replaced by the result view.
    expect(screen.queryByText(enMessages.Plan.next)).not.toBeInTheDocument();
  });

  it("maps a stream error to a localized toast while keeping the form", () => {
    mockState.error = new Error("boom");
    renderGenerator();

    expect(toastError).toHaveBeenCalledWith(enMessages.PlanErrors.generation_failed);
    // The form remains in place for retry with inputs preserved.
    expect(screen.getByText(enMessages.Plan.next)).toBeInTheDocument();
  });
});

import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import PlanView from "@/components/plan/plan-view";
import enMessages from "@/i18n/messages/en.json";
import plMessages from "@/i18n/messages/pl.json";
import type { GeneratedPlan } from "@/lib/validation/plan-schema";

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
    { day: "Tue", exercises: [{ name: "Sprints", reps: "30s", sets: 5 }], focus: "Intervals", isRest: false },
    { day: "Wed", focus: "Recovery", isRest: true },
    {
      day: "Thu",
      exercises: [{ muscleGroup: "Legs", name: "Back Squat", reps: "6-8", sets: 4 }],
      focus: "Lower Strength",
      isRest: false,
    },
  ],
};

const allRestFixture: GeneratedPlan = {
  ...fixture,
  weeklySchedule: [
    { day: "Mon", focus: "Recovery", isRest: true },
    { day: "Tue", focus: "Recovery", isRest: true },
    { day: "Wed", focus: "Recovery", isRest: true },
    { day: "Thu", focus: "Recovery", isRest: true },
    { day: "Fri", focus: "Recovery", isRest: true },
    { day: "Sat", focus: "Recovery", isRest: true },
    { day: "Sun", focus: "Recovery", isRest: true },
  ],
};

function renderView() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <PlanView plan={fixture} />
    </NextIntlClientProvider>,
  );
}

describe("PlanView", () => {
  it("renders the weekly grid, summary, dietary tips, cardio ring, and calorie target", () => {
    renderView();

    // Weekly grid: every day label is present.
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Tue")).toBeInTheDocument();
    expect(screen.getByText("Wed")).toBeInTheDocument();
    expect(screen.getByText("Thu")).toBeInTheDocument();

    expect(screen.getByText(fixture.summary)).toBeInTheDocument();
    expect(screen.getByText("Pre-workout protein")).toBeInTheDocument();
    expect(screen.getByText("150 min")).toBeInTheDocument();
    expect(screen.getByText("2200 kcal")).toBeInTheDocument();
  });

  it("defaults to the first non-rest day and swaps exercises on tab switch", async () => {
    const user = userEvent.setup();
    renderView();

    // Defaults to the first non-rest day (Mon → Upper Strength).
    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.queryByText("Back Squat")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Lower Strength/ }));

    expect(screen.getByText("Back Squat")).toBeInTheDocument();
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument();
  });

  it("renders the health disclaimer from the plan", () => {
    renderView();

    expect(screen.getByText(enMessages.Plan.disclaimerTitle)).toBeInTheDocument();
    expect(screen.getByText(fixture.disclaimer)).toBeInTheDocument();
  });

  it("renders Plan.viewTitle in the active EN locale", () => {
    renderView();

    expect(screen.getByText(enMessages.Plan.viewTitle)).toBeInTheDocument();
  });

  it("renders the rest-day panel at index 0 when every day is a rest day (all-rest fallback)", () => {
    // WeeklySchedule.findIndex returns -1 when no day has isRest=false;
    // the fallback `=== -1 ? 0 : firstTrainingDay` selects index 0.
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <PlanView plan={allRestFixture} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(enMessages.Plan.restDayTitle)).toBeInTheDocument();
  });

  it("renders Plan.viewTitle in the active PL locale and differs from EN", () => {
    // Proves locale-driven rendering of static chrome (h1), not fixture-content passthrough.
    // If the catalogs ever collapse to the same string, this assertion catches it.
    expect(plMessages.Plan.viewTitle).not.toBe(enMessages.Plan.viewTitle);

    render(
      <NextIntlClientProvider locale="pl" messages={plMessages}>
        <PlanView plan={fixture} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(plMessages.Plan.viewTitle)).toBeInTheDocument();
  });
});


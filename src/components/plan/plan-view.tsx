"use client";

import { useTranslations } from "next-intl";

import PlanDisclaimer from "@/components/plan/plan-disclaimer";
import type { GeneratedPlan } from "@/lib/validation/plan-schema";
import {
  AiSummary,
  CalorieTarget,
  CardioRing,
  DietaryTips,
  GoalChip,
  ProgressionTimeline,
  WeeklySchedule,
} from "./plan-view/index";

/**
 * Presentational rendering of a complete, persisted `GeneratedPlan` — the design's
 * structured plan view. Dumb: receives the full plan as a prop (the `/plan` page
 * fetches it) and never touches a partial object. Composes the schedule, summary,
 * sidebar cards, and the mandatory health disclaimer.
 */
function PlanView({ plan }: Props) {
  const t = useTranslations("Plan");

  return (
    <div className="mx-auto flex w-full max-w-400 flex-col gap-stack-md px-container-margin py-stack-lg">
      <header>
        <h1 className="font-headline-xl text-headline-lg-mobile text-primary md:text-headline-xl">
          {t("viewTitle")}
        </h1>
        <GoalChip goal={plan.goal} />
      </header>

      <AiSummary summary={plan.summary} />

      <WeeklySchedule days={plan.weeklySchedule} />

      <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
        <CalorieTarget
          kcal={plan.calorieTarget.kcal}
          note={plan.calorieTarget.note}
        />
        <DietaryTips tips={plan.dietaryTips} />
        <CardioRing
          note={plan.cardioGoal.note}
          targetMinutes={plan.cardioGoal.targetMinutes}
        />
        <ProgressionTimeline
          milestones={plan.milestones}
          progression={plan.progression}
          timelineWeeks={plan.timelineWeeks}
        />
      </div>

      <PlanDisclaimer disclaimer={plan.disclaimer} />
    </div>
  );
}

interface Props {
  plan: GeneratedPlan;
}

export default PlanView;

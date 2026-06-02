"use client";

import { useTranslations } from "next-intl";

import type { GeneratedPlan } from "@/lib/validation/plan-schema";

/**
 * The selected day's exercise list (design's "Trening na dziś" rows): name,
 * muscle group, sets and reps. Pure presentational — receives one day's exercises.
 */
function DayExercises({ exercises }: Props) {
  const t = useTranslations("Plan");

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-surface-container-highest">
      {exercises.map((exercise, index) => (
        <div
          key={`${exercise.name}-${index}`}
          className="flex items-center justify-between gap-stack-md border-b border-surface-container-highest bg-surface-container px-stack-md py-stack-sm last:border-b-0"
        >
          <div>
            <h4 className="font-label-md text-label-md text-primary">{exercise.name}</h4>
            {exercise.muscleGroup ? (
              <span className="text-[12px] text-on-surface-variant">{exercise.muscleGroup}</span>
            ) : null}
            {exercise.note ? (
              <p className="mt-1 text-[12px] text-on-surface-variant">{exercise.note}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-stack-md text-right">
            <div>
              <div className="font-label-md text-label-md text-on-surface-variant">{t("setsLabel")}</div>
              <div className="font-stats-display text-[20px] text-primary">{exercise.sets}</div>
            </div>
            <div>
              <div className="font-label-md text-label-md text-on-surface-variant">{t("repsLabel")}</div>
              <div className="font-stats-display text-[20px] text-primary">{exercise.reps}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type Exercise = NonNullable<GeneratedPlan["weeklySchedule"][number]["exercises"]>[number];

interface Props {
  exercises: Exercise[];
}

export default DayExercises;

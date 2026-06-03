"use client";

import { Dumbbell, Moon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { GeneratedPlan } from "@/lib/validation/plan-schema";
import DayExercises from "./day-exercises";

/**
 * Interactive weekly schedule (design's day grid + "Trening na dziś"). Selecting a
 * day reveals that day's exercises; the initial selection defaults to the first
 * non-rest day. Day selection is the only client state — this is why the schedule
 * is the `"use client"` boundary while the rest of the plan view stays static.
 */
function WeeklySchedule({ days }: Props) {
  const t = useTranslations("Plan");
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const firstTrainingDay = days.findIndex((day) => !day.isRest);
    return firstTrainingDay === -1 ? 0 : firstTrainingDay;
  });

  const selectedDay = days[selectedIndex];

  return (
    <section>
      <h3 className="mb-stack-md font-headline-md text-headline-md text-primary">
        {t("weeklyScheduleTitle")}
      </h3>
      <div className="grid grid-cols-2 gap-stack-md sm:grid-cols-4 md:grid-cols-7">
        {days.map((day, index) => (
          <button
            key={`${day.day}-${index}`}
            type="button"
            onClick={() => setSelectedIndex(index)}
            aria-pressed={index === selectedIndex}
            className={cn(
              "flex min-h-[100px] flex-col items-center justify-center rounded border p-stack-sm text-center transition-colors",
              day.isRest
                ? "border-dashed border-surface-container-highest bg-surface-container-lowest"
                : "cursor-pointer border-surface-container-highest bg-surface-container-low hover:bg-surface-container-highest",
              index === selectedIndex && "border-primary-container bg-surface-container-highest"
            )}
          >
            <span className="mb-1 font-label-md text-label-md uppercase text-on-surface-variant">
              {day.day}
            </span>
            {day.isRest ? (
              <Moon className="mb-1 size-5 text-on-surface-variant opacity-50" />
            ) : (
              <Dumbbell className="mb-1 size-5 text-primary-container" />
            )}
            <span className="text-[10px] font-label-md text-on-surface">{day.focus}</span>
          </button>
        ))}
      </div>

      <div className="mt-stack-lg rounded-lg border border-surface-container-highest bg-surface-container-low p-container-margin">
        {selectedDay?.isRest || !selectedDay?.exercises?.length ? (
          <div className="flex flex-col items-center gap-stack-sm py-stack-md text-center">
            <Moon className="size-8 text-on-surface-variant opacity-50" />
            <h3 className="font-headline-md text-headline-md text-primary">{t("restDayTitle")}</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">{t("restDayBody")}</p>
          </div>
        ) : (
          <>
            <h3 className="mb-stack-md flex items-center gap-2 font-headline-md text-headline-md text-primary">
              <span className="inline-block size-3 rounded-full bg-primary-container" />
              {t("workoutFor", { focus: selectedDay.focus })}
            </h3>
            <DayExercises exercises={selectedDay.exercises} />
          </>
        )}
      </div>
    </section>
  );
}

interface Props {
  days: GeneratedPlan["weeklySchedule"];
}

export default WeeklySchedule;

"use client";

import { useTranslations } from "next-intl";

/**
 * FR-011's "pick which workout day/session" step as selectable cards. Dumb
 * component: the flow filters the plan's loggable days and `onPick` receives the
 * index into that *filtered* list, not the raw weekly schedule.
 */
function DayPicker({ days, onPick }: Props) {
  const t = useTranslations("LogWorkout");

  return (
    <div className="space-y-stack-md">
      <h2 className="font-headline-md text-headline-md text-on-surface">
        {t("dayPickerHeading")}
      </h2>
      <div className="grid gap-stack-md sm:grid-cols-2 lg:grid-cols-3">
        {days.map((day, index) => (
          <button
            key={`${day.day}-${index}`}
            type="button"
            className="flex cursor-pointer flex-col items-start gap-stack-sm rounded-lg border border-surface-container-highest bg-surface-container-low p-container-margin text-left transition-colors hover:bg-surface-container-high"
            onClick={() => onPick(index)}
          >
            <span className="font-label-md text-label-md uppercase text-on-surface-variant">
              {day.day}
            </span>
            <span className="font-body-lg text-body-lg text-on-surface">{day.focus}</span>
            <span className="font-label-md text-label-md text-on-surface-variant">
              {t("exerciseCount", { count: day.exerciseCount })}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface PickableDay {
  day: string;
  exerciseCount: number;
  focus: string;
}

interface Props {
  days: PickableDay[];
  onPick: (index: number) => void;
}

export { type PickableDay };
export default DayPicker;

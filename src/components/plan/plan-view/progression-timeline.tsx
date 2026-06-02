"use client";

import { Calendar, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

/** Progression steps, plan timeline (weeks), and milestones. */
function ProgressionTimeline({ milestones, progression, timelineWeeks }: Props) {
  const t = useTranslations("Plan");

  return (
    <div className="flex flex-col gap-stack-md rounded-lg border border-surface-container-highest bg-surface-container-low p-container-margin">
      <div className="flex items-center justify-between gap-stack-sm">
        <h3 className="flex items-center gap-2 font-headline-md text-headline-md text-primary">
          <Calendar className="size-5 text-primary-container" />
          {t("timelineTitle")}
        </h3>
        <span className="font-stats-display text-[20px] text-primary-container">
          {t("timelineWeeksValue", { weeks: timelineWeeks })}
        </span>
      </div>

      {progression.length > 0 ? (
        <div>
          <h4 className="mb-stack-sm flex items-center gap-2 font-label-md text-label-md uppercase text-on-surface-variant">
            <TrendingUp className="size-4 text-primary-container" />
            {t("progressionTitle")}
          </h4>
          <ul className="flex flex-col gap-stack-sm">
            {progression.map((step, index) => (
              <li key={index} className="text-[14px] leading-tight text-on-surface-variant">
                {step}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {milestones.length > 0 ? (
        <div>
          <h4 className="mb-stack-sm font-label-md text-label-md uppercase text-on-surface-variant">
            {t("milestonesTitle")}
          </h4>
          <ul className="flex list-disc flex-col gap-stack-sm pl-5">
            {milestones.map((milestone, index) => (
              <li key={index} className="text-[14px] leading-tight text-on-surface-variant">
                {milestone}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

interface Props {
  milestones: string[];
  progression: string[];
  timelineWeeks: number;
}

export default ProgressionTimeline;

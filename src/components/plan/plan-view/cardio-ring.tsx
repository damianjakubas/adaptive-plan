"use client";

import { useTranslations } from "next-intl";

/**
 * Weekly cardio goal ring (design's "Tygodniowy Cel Cardio"). Progress tracking is
 * out of scope this slice, so the ring renders the target as the goal (full ring),
 * with the target minutes as the centre value and the AI note alongside.
 */
function CardioRing({ note, targetMinutes }: Props) {
  const t = useTranslations("Plan");

  return (
    <div className="rounded-lg border border-surface-container-highest bg-surface-container-low p-container-margin">
      <h3 className="mb-stack-sm font-label-md text-label-md uppercase text-on-surface-variant">
        {t("cardioGoalTitle")}
      </h3>
      <div className="flex items-end gap-4">
        <div className="relative flex size-24 items-center justify-center">
          <svg className="size-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" fill="none" r="45" stroke="#333333" strokeWidth="8" />
            <circle cx="50" cy="50" fill="none" r="45" stroke="#caf300" strokeWidth="8" />
          </svg>
          <div className="absolute font-stats-display text-headline-md text-primary">
            {targetMinutes}
          </div>
        </div>
        <div className="pb-2">
          <div className="font-headline-md text-headline-md text-primary-container">
            {t("minutesValue", { minutes: targetMinutes })}
          </div>
          <p className="mt-1 text-[14px] leading-tight text-on-surface-variant">{note}</p>
        </div>
      </div>
    </div>
  );
}

interface Props {
  note: string;
  targetMinutes: number;
}

export default CardioRing;

"use client";

import { Flame } from "lucide-react";
import { useTranslations } from "next-intl";

/** Daily calorie-target card with the AI note. */
function CalorieTarget({ kcal, note }: Props) {
  const t = useTranslations("Plan");

  return (
    <div className="rounded-lg border border-surface-container-highest bg-surface-container-low p-container-margin">
      <h3 className="mb-stack-sm flex items-center gap-2 font-label-md text-label-md uppercase text-on-surface-variant">
        <Flame className="size-5 text-primary-container" />
        {t("calorieTargetTitle")}
      </h3>
      <div className="font-stats-display text-stats-display text-primary-container">
        {t("kcalValue", { kcal })}
      </div>
      <p className="mt-1 text-[14px] leading-tight text-on-surface-variant">{note}</p>
    </div>
  );
}

interface Props {
  kcal: number;
  note: string;
}

export default CalorieTarget;

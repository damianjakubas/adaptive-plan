"use client";

import { useTranslations } from "next-intl";

/** Goal label + the AI-chosen goal, mirroring the design's header chip. */
function GoalChip({ goal }: Props) {
  const t = useTranslations("Plan");

  return (
    <div className="mt-stack-sm flex items-center gap-stack-sm">
      <span className="rounded-full border border-outline-variant bg-surface-container-highest px-3 py-1 text-label-md font-label-md uppercase text-on-surface-variant">
        {t("viewGoalLabel")}
      </span>
      <span className="font-headline-md text-headline-md text-primary-container">{goal}</span>
    </div>
  );
}

interface Props {
  goal: string;
}

export default GoalChip;

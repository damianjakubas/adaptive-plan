"use client";

import { CheckCircle2, Utensils } from "lucide-react";
import { useTranslations } from "next-intl";

/** Dietary-tips sidebar (design's "Wskazówki dietetyczne"). */
function DietaryTips({ tips }: Props) {
  const t = useTranslations("Plan");

  return (
    <div className="rounded-lg border border-surface-container-highest bg-surface-container-low p-container-margin">
      <h3 className="mb-stack-md flex items-center gap-2 font-headline-md text-headline-md text-primary">
        <Utensils className="size-5 text-primary-container" />
        {t("dietaryTipsTitle")}
      </h3>
      <ul className="flex flex-col gap-stack-sm">
        {tips.map((tip, index) => (
          <li
            key={`${tip.title}-${index}`}
            className="flex items-start gap-stack-sm rounded border border-surface-container-highest bg-surface-container-lowest p-3"
          >
            <CheckCircle2 className="mt-1 size-5 shrink-0 text-primary-container" />
            <div>
              <h4 className="font-label-md text-label-md text-primary">{tip.title}</h4>
              <p className="mt-1 text-[14px] leading-tight text-on-surface-variant">{tip.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface Props {
  tips: { body: string; title: string }[];
}

export default DietaryTips;

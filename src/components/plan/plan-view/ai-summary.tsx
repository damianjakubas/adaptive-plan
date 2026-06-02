"use client";

import { Bot } from "lucide-react";
import { useTranslations } from "next-intl";

/** The AI recommendation summary block (design's "Podsumowanie zaleceń AI"). */
function AiSummary({ summary }: Props) {
  const t = useTranslations("Plan");

  return (
    <section className="rounded-lg border border-surface-container-highest bg-surface-container-low p-container-margin">
      <div className="mb-stack-sm flex items-center gap-stack-sm">
        <Bot className="size-5 text-primary-container" />
        <h2 className="font-headline-md text-headline-md text-primary">{t("aiSummaryTitle")}</h2>
      </div>
      <p className="max-w-3xl font-body-lg text-body-lg text-on-surface-variant">{summary}</p>
    </section>
  );
}

interface Props {
  summary: string;
}

export default AiSummary;

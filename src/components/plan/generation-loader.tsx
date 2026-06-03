"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * The design's full-screen abstract generation screen. Driven purely by the parent's
 * loading state — the partial streamed object is intentionally NOT shown here (the
 * abstract-loader UX decision). The progress ring is decorative (the free-tier stream
 * gives no real %); status lines and motivational quotes rotate on a timer. Dumb:
 * local UI state only, no data fetching.
 */
function GenerationLoader() {
  const t = useTranslations("Plan");
  const statuses = t.raw("loaderStatuses") as string[];
  const quotes = t.raw("loaderQuotes") as string[];
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((prev) => prev + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  const status = statuses[tick % statuses.length];
  const quote = quotes[tick % quotes.length];

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-stack-lg px-container-margin py-stack-lg text-center">
      <div className="relative flex h-48 w-48 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-4 border-surface-container-highest" />
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary-container" />
        <div className="flex h-32 w-32 animate-pulse items-center justify-center rounded-full border border-primary-container/30 bg-primary-container/10" />
      </div>

      <div className="flex flex-col gap-stack-sm">
        <h1 className="font-headline-lg text-headline-lg-mobile text-primary md:text-headline-lg">
          {t("loaderTitle")}
        </h1>
        <p className="max-w-lg font-body-lg text-body-lg text-on-surface-variant">
          {t("loaderSubtitle")}
        </p>
      </div>

      <p aria-live="polite" className="font-label-md text-label-md text-on-surface-variant">
        {status}
      </p>
      <p className="max-w-lg font-body-md text-body-md text-on-surface-variant/80 italic">
        {quote}
      </p>
    </div>
  );
}

export default GenerationLoader;

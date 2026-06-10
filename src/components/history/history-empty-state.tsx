import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * Plan-state-aware empty state for `/history`. Mirrors `LogWorkoutEmptyState`'s
 * centered layout but uses the sync `useTranslations` shared-component pattern
 * (no `"use client"`, no async `getTranslations`) so it stays RTL-testable —
 * see lessons.md carve-out.
 *
 * The CTA branches on plan state to avoid a dead-end into the gated logging
 * page: an active plan points to `/log-workout`; no plan points to `/plan/new`.
 */
function HistoryEmptyState({ hasActivePlan }: Props) {
  const t = useTranslations("History");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-stack-md py-stack-lg text-center">
      <h1 className="font-headline-md text-headline-md text-on-surface">{t("emptyTitle")}</h1>
      <p className="font-body-lg text-body-lg text-on-surface-variant">
        {hasActivePlan ? t("emptyBodyLog") : t("emptyBodyPlan")}
      </p>
      <Button asChild>
        <Link href={hasActivePlan ? "/log-workout" : "/plan/new"}>
          {hasActivePlan ? t("emptyCtaLog") : t("emptyCtaPlan")}
        </Link>
      </Button>
    </div>
  );
}

interface Props {
  hasActivePlan: boolean;
}

export default HistoryEmptyState;

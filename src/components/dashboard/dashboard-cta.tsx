import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * State-aware primary call-to-action for the welcome dashboard (FR-010 /
 * Business Logic rule 4). Mirrors `HistoryEmptyState`'s `Button asChild` + `Link`
 * pattern and the sync `useTranslations` shared-component carve-out (no
 * `"use client"`, no async `getTranslations`) so it stays RTL-testable.
 *
 * - No active plan → a single "generate a plan" button → `/plan/new`.
 * - Active plan → a primary "log a workout" button → `/log-workout` plus a
 *   secondary (outline) "view plan" button → `/plan`.
 */
function DashboardCta({ hasActivePlan }: Props) {
  const t = useTranslations("Dashboard");

  if (!hasActivePlan) {
    return (
      <Button asChild>
        <Link href="/plan/new">{t("ctaGenerate")}</Link>
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap gap-stack-sm">
      <Button asChild>
        <Link href="/log-workout">{t("ctaLog")}</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/plan">{t("ctaViewPlan")}</Link>
      </Button>
    </div>
  );
}

interface Props {
  hasActivePlan: boolean;
}

export default DashboardCta;

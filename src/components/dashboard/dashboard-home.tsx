import { useTranslations } from "next-intl";

import type { SessionListItem } from "@/db/workout-sessions";
import DashboardCta from "./dashboard-cta";
import DashboardRecentSessions from "./dashboard-recent-sessions";

/**
 * Presentational body of the welcome dashboard. Composes the heading, the
 * has-plan-only plan glance (eyebrow + goal/summary), the state-aware
 * `DashboardCta`, and the has-plan-only `DashboardRecentSessions` into the
 * page body. Dumb: no data fetching, no side effects. Sync `useTranslations`
 * shared-component pattern, no `"use client"` (lessons.md carve-out).
 *
 * Renders cleanly for a brand-new user (no active plan, empty goal/summary, no
 * sessions): the plan glance and recent-sessions section are gated behind
 * `hasActivePlan`, so the no-plan view is just the heading + the generate CTA.
 */
function DashboardHome({
  hasActivePlan,
  planGoal,
  planSummary,
  recentSessions,
}: Props) {
  const t = useTranslations("Dashboard");

  return (
    <div className="container mx-auto max-w-5xl px-container-margin py-12">
      <div className="space-y-stack-lg">
        <h1 className="font-headline-md text-headline-md text-on-surface">{t("heading")}</h1>

        {hasActivePlan && (
          <div className="space-y-2">
            <p className="font-label-md text-label-md uppercase tracking-wider text-primary-container">
              {t("planEyebrow")}
            </p>
            {planGoal && (
              <p className="font-body-lg text-body-lg font-semibold text-on-surface">{planGoal}</p>
            )}
            {planSummary && (
              <p className="font-body-md text-body-md text-on-surface-variant">{planSummary}</p>
            )}
          </div>
        )}

        <DashboardCta hasActivePlan={hasActivePlan} />

        {hasActivePlan && <DashboardRecentSessions sessions={recentSessions} />}
      </div>
    </div>
  );
}

interface Props {
  hasActivePlan: boolean;
  planGoal: string;
  planSummary: string;
  recentSessions: SessionListItem[];
}

export default DashboardHome;

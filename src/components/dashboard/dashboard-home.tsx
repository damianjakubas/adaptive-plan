import { useTranslations } from "next-intl";

import type { SessionListItem } from "@/db/workout-sessions";
import DashboardCta from "./dashboard-cta";
import DashboardRecentSessions from "./dashboard-recent-sessions";
import DashboardWelcome from "./dashboard-welcome";

/**
 * Presentational body of the welcome dashboard. Branches on plan state:
 *
 * - No active plan (brand-new user) → the `DashboardWelcome` onboarding view
 *   (hero + value-prop feature grid + generate CTA). This is the post-auth
 *   landing (S-05), so it must welcome rather than drop the user on a bare page.
 * - Active plan (returning user) → the heading, the plan glance (eyebrow +
 *   goal/summary), the log/view-plan CTA, and the recent-sessions section.
 *
 * Dumb: no data fetching, no side effects. Sync `useTranslations`
 * shared-component pattern, no `"use client"` (lessons.md carve-out). Renders
 * cleanly for an active plan with empty goal/summary (the lines are gated).
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
      {!hasActivePlan ? (
        <DashboardWelcome />
      ) : (
        <div className="space-y-stack-lg">
          <h1 className="font-headline-md text-headline-md text-on-surface">{t("heading")}</h1>

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

          <DashboardCta hasActivePlan={hasActivePlan} />

          <DashboardRecentSessions sessions={recentSessions} />
        </div>
      )}
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

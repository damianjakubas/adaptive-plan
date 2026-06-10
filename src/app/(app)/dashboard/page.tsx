import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { DashboardHome } from "@/components/dashboard";
import { getActivePlan } from "@/db/plans";
import { listSessions } from "@/db/workout-sessions";
import { getUser } from "@/lib/supabase/get-user";
import type { GeneratedPlan } from "@/lib/validation/plan-schema";

export async function generateMetadata() {
  const t = await getTranslations("Nav");
  return { title: t("dashboard") };
}

/**
 * Authenticated `/dashboard` page (S-04, FR-010) — state-aware welcome home.
 * Server gate + data load, minimal JSX: loads the active plan and recent
 * sessions, derives a small view-model, hands it to the presentational
 * `DashboardHome`. Mirrors `/history`'s and `/plan`'s server-page contract.
 *
 * `hasActivePlan` is derived from the full plan being non-null (one
 * `getActivePlan` call, not the cheap navbar `hasActivePlan` gate) since the
 * glance needs the plan's goal/summary. Sessions are sliced to the 3 most
 * recent for the glance; `listSessions` is newest-first.
 */
export default async function DashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const [activePlan, sessions] = await Promise.all([
    getActivePlan(user.id),
    listSessions(user.id, 3),
  ]);

  const plan = activePlan ? (activePlan.plan as GeneratedPlan) : null;

  return (
    <DashboardHome
      hasActivePlan={plan !== null}
      planGoal={plan?.goal ?? ""}
      planSummary={plan?.summary ?? ""}
      recentSessions={sessions.slice(0, 3)}
    />
  );
}

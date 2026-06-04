import { redirect } from "next/navigation";

import PlanEmptyState from "@/components/plan/plan-empty-state";
import PlanView from "@/components/plan/plan-view";
import { getActivePlan } from "@/db/plans";
import { createClient } from "@/lib/supabase/server";
import type { GeneratedPlan } from "@/lib/validation/plan-schema";

export const metadata = {
  title: "Training Plan",
};

/**
 * Authenticated `/plan` page — the from-DB entry point for the user's single active
 * plan (cold loads, refresh, re-login). Reads the complete persisted row and hands
 * the typed plan to the presentational view; renders an empty state when none exists.
 */
export default async function PlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const activePlan = await getActivePlan(user.id);

  if (!activePlan) {
    return <PlanEmptyState />;
  }

  return <PlanView plan={activePlan.plan as GeneratedPlan} />;
}

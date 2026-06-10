import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { LogWorkoutEmptyState, LogWorkoutFlow } from "@/components/workout";
import { getActivePlan } from "@/db/plans";
import { createClient } from "@/lib/supabase/server";
import type { GeneratedPlan } from "@/lib/validation/plan-schema";

export const metadata = {
  title: "Log Workout",
};

/**
 * Authenticated `/log-workout` page (US-01): server gate + data load, minimal
 * JSX. No active plan renders the FR-017 blocked state; otherwise the smart
 * client flow takes over (day picker → pre-filled editor → save action).
 */
export default async function LogWorkoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const activePlan = await getActivePlan(user.id);

  if (!activePlan) {
    return <LogWorkoutEmptyState />;
  }

  const t = await getTranslations("LogWorkout");

  return (
    <div className="container mx-auto max-w-3xl px-container-margin py-12">
      <div className="mb-8 space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">{t("subtitle")}</p>
      </div>
      <LogWorkoutFlow weeklySchedule={(activePlan.plan as GeneratedPlan).weeklySchedule} />
    </div>
  );
}

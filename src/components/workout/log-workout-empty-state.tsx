import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

/**
 * FR-017's "page cannot be used" face: shown on `/log-workout` when the user has
 * no active plan — explains why and links to plan generation (mirrors
 * `PlanEmptyState`). Server-renderable, so it uses `getTranslations`.
 */
async function LogWorkoutEmptyState() {
  const t = await getTranslations("LogWorkout");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-stack-md py-stack-lg text-center">
      <h1 className="font-headline-md text-headline-md text-on-surface">{t("noPlanTitle")}</h1>
      <p className="font-body-lg text-body-lg text-on-surface-variant">{t("noPlanBody")}</p>
      <Button asChild>
        <Link href="/plan/new">{t("noPlanCta")}</Link>
      </Button>
    </div>
  );
}

export default LogWorkoutEmptyState;

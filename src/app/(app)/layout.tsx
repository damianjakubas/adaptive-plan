import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { LocaleToggle } from "@/components/locale-toggle";
import { Button } from "@/components/ui/button";
import { hasActivePlan } from "@/db/plans";
import { signOut } from "@/lib/auth/actions";
import { getUser } from "@/lib/supabase/get-user";
import { logWorkoutError } from "@/lib/workout/log-workout-error";

/**
 * Authenticated shell for the `(app)` route group. Mounts the brand mark, the app
 * nav, the PL/EN locale toggle, and the sign-out control. "History" is always
 * enabled — it's meaningful regardless of plan state. "Log Workout" is
 * plan-state-aware (FR-017): a link when an active plan exists,
 * otherwise a disabled span — `hasActivePlan` is an id-only, limit-1 query so the
 * per-render cost stays negligible.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("Nav");
  const user = await getUser();
  // A transient DB failure must degrade to a disabled entry, not crash the shell.
  let canLogWorkout = false;
  if (user) {
    try {
      canLogWorkout = await hasActivePlan(user.id);
    } catch (error) {
      logWorkoutError({ error, stage: "navbar-active-plan-check" });
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-on-surface">
      <header className="flex items-center justify-between px-container-margin py-stack-md">
        <div className="flex items-center gap-stack-lg">
          <span className="font-headline-md text-headline-md text-primary-container">
            AdaptivePlan
          </span>
          <nav className="hidden items-center gap-stack-md md:flex">
            <Link
              href="/plan"
              className="font-label-md text-label-md text-on-surface-variant transition-colors hover:text-primary-container"
            >
              {t("plan")}
            </Link>
            <Link
              href="/plan/new"
              className="font-label-md text-label-md text-on-surface-variant transition-colors hover:text-primary-container"
            >
              {t("newPlan")}
            </Link>
            {canLogWorkout ? (
              <Link
                href="/log-workout"
                className="font-label-md text-label-md text-on-surface-variant transition-colors hover:text-primary-container"
              >
                {t("logWorkout")}
              </Link>
            ) : (
              <span aria-disabled="true" className="font-label-md text-label-md text-on-surface-variant opacity-40">
                {t("logWorkout")}
              </span>
            )}
            <Link
              href="/history"
              className="font-label-md text-label-md text-on-surface-variant transition-colors hover:text-primary-container"
            >
              {t("history")}
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-stack-md">
          <LocaleToggle />
          <form action={signOut}>
            <Button type="submit" variant="outline">
              {t("logout")}
            </Button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

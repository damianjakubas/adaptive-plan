import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { LocaleToggle } from "@/components/locale-toggle";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";

/**
 * Authenticated shell for the `(app)` route group. Mounts the brand mark, the app
 * nav, the PL/EN locale toggle, and the sign-out control. Only routes that exist
 * this slice are linked; "Progress" is shown as a placeholder until its slice lands.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("Nav");

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
            <span className="font-label-md text-label-md text-on-surface-variant opacity-40">
              {t("progress")}
            </span>
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

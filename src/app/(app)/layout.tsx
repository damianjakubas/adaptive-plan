import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { LocaleToggle } from "@/components/locale-toggle";

/**
 * Authenticated shell for the `(app)` route group. Mounts the brand mark, the app
 * nav, and the PL/EN locale toggle. Only routes that exist this slice are linked;
 * "Progress" is shown as a placeholder until its slice lands.
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
              href="/dashboard"
              className="font-label-md text-label-md text-on-surface-variant transition-colors hover:text-primary-container"
            >
              {t("dashboard")}
            </Link>
            <Link
              href="/plan"
              className="font-label-md text-label-md text-on-surface-variant transition-colors hover:text-primary-container"
            >
              {t("plan")}
            </Link>
            <span className="font-label-md text-label-md text-on-surface-variant opacity-40">
              {t("progress")}
            </span>
          </nav>
        </div>
        <LocaleToggle />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

import type { ReactNode } from "react";

import { LocaleToggle } from "@/components/locale-toggle";

/**
 * Authenticated shell for the `(app)` route group. Mounts the brand mark and the
 * PL/EN locale toggle in the header; S-02 builds the rest of the app chrome here.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-on-surface">
      <header className="flex items-center justify-between px-container-margin py-stack-md">
        <span className="font-headline-md text-headline-md text-primary-container">
          AdaptivePlan
        </span>
        <LocaleToggle />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

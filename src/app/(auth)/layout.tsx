import type { ReactNode } from "react";

import { LocaleToggle } from "@/components/locale-toggle";

/**
 * Auth shell: centers the card on the dark, high-contrast background and mounts
 * the PL/EN locale toggle discreetly in the corner (the mockup has no navbar).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-background px-container-margin">
      {/* Atmospheric gradient backdrop (mockup's image layer, simplified) */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-background via-surface-container-lowest/90 to-background" />

      <header className="absolute right-container-margin top-container-margin z-20">
        <LocaleToggle />
      </header>

      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}

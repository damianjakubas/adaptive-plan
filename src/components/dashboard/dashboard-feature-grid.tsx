import { useTranslations } from "next-intl";

import DASHBOARD_FEATURES from "./dashboard-features";

/**
 * Three-card value-prop grid for the no-plan welcome dashboard — the "what the AI
 * does for you" onboarding content from the `dashboard_og_lny` design. Dumb: maps
 * the static `DASHBOARD_FEATURES` config to glass-style cards. Sync
 * `useTranslations` shared-component pattern, no `"use client"` (lessons.md
 * carve-out), so it stays RTL-testable.
 */
function DashboardFeatureGrid() {
  const t = useTranslations("Dashboard");

  return (
    <section className="grid grid-cols-1 gap-gutter md:grid-cols-3">
      {DASHBOARD_FEATURES.map(({ Icon, bodyKey, titleKey }) => (
        <article
          key={titleKey}
          className="flex flex-col gap-stack-sm rounded-xl border border-surface-container-highest bg-surface-container p-container-margin transition-colors hover:bg-surface-container-high"
        >
          <span className="mb-stack-sm flex size-12 items-center justify-center rounded-full bg-surface-container-high">
            <Icon className="size-6 text-primary-container" aria-hidden="true" />
          </span>
          <h3 className="font-headline-md text-headline-md text-on-surface">{t(titleKey)}</h3>
          <p className="font-body-md text-body-md text-on-surface-variant">{t(bodyKey)}</p>
        </article>
      ))}
    </section>
  );
}

export default DashboardFeatureGrid;

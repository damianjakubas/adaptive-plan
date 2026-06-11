import { useTranslations } from "next-intl";

import DashboardCta from "./dashboard-cta";
import DashboardFeatureGrid from "./dashboard-feature-grid";

/**
 * Welcome / onboarding view for a brand-new user (no active plan) — the
 * `dashboard_og_lny` design: a hero (data-driven eyebrow, value-prop headline,
 * subtitle) anchored by the "generate a plan" CTA, followed by the three-card
 * feature grid. Replaces the former bare heading + button so the post-auth
 * landing (S-05) actually welcomes the user. Dumb: composes `DashboardCta`
 * (no-plan branch) and `DashboardFeatureGrid`; no data fetching, no side effects.
 * Sync `useTranslations` shared-component pattern, no `"use client"`
 * (lessons.md carve-out).
 */
function DashboardWelcome() {
  const t = useTranslations("Dashboard");

  return (
    <div className="space-y-stack-lg">
      <section className="space-y-stack-md">
        <p className="font-label-md text-label-md uppercase tracking-widest text-primary-container">
          {t("welcomeEyebrow")}
        </p>
        <h1 className="font-headline-lg text-headline-lg text-on-surface md:font-headline-xl md:text-headline-xl">
          {t("welcomeHeadline")}
        </h1>
        <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
          {t("welcomeSubtitle")}
        </p>
        <DashboardCta hasActivePlan={false} />
      </section>

      <DashboardFeatureGrid />
    </div>
  );
}

export default DashboardWelcome;

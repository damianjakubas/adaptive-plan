import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DashboardCta from "@/components/dashboard/dashboard-cta";
import enMessages from "@/i18n/messages/en.json";
import plMessages from "@/i18n/messages/pl.json";

function renderCta(
  locale: "en" | "pl",
  messages: typeof enMessages,
  hasActivePlan: boolean,
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <DashboardCta hasActivePlan={hasActivePlan} />
    </NextIntlClientProvider>,
  );
}

// Oracle: FR-010 / Business Logic rule 4 — the dashboard CTA is derived from
// plan state. No plan → exactly one "generate" CTA → /plan/new. Active plan →
// a primary "log a workout" CTA → /log-workout AND a secondary "view plan"
// CTA → /plan. Expected copy/destinations come from the catalogs + the chosen
// layout, not from re-reading the component.
describe.each([
  { locale: "en" as const, messages: enMessages },
  { locale: "pl" as const, messages: plMessages },
])("DashboardCta ($locale)", ({ locale, messages }) => {
  const t = messages.Dashboard;

  it("renders exactly the generate CTA to /plan/new when there is no active plan", () => {
    renderCta(locale, messages, false);

    const generate = screen.getByRole("link", { name: t.ctaGenerate });
    expect(generate).toHaveAttribute("href", "/plan/new");

    // No-plan branch is a single CTA: the log/view-plan actions must be absent.
    expect(screen.queryByRole("link", { name: t.ctaLog })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: t.ctaViewPlan })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("renders the primary log CTA to /log-workout and the secondary view-plan CTA to /plan when a plan is active", () => {
    renderCta(locale, messages, true);

    const log = screen.getByRole("link", { name: t.ctaLog });
    expect(log).toHaveAttribute("href", "/log-workout");

    const viewPlan = screen.getByRole("link", { name: t.ctaViewPlan });
    expect(viewPlan).toHaveAttribute("href", "/plan");

    // Has-plan branch must not also surface the no-plan generate CTA.
    expect(screen.queryByRole("link", { name: t.ctaGenerate })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});

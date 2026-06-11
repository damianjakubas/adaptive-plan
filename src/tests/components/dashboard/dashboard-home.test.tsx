import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DashboardHome from "@/components/dashboard/dashboard-home";
import type { SessionListItem } from "@/db/workout-sessions";
import enMessages from "@/i18n/messages/en.json";
import plMessages from "@/i18n/messages/pl.json";

function renderHome(
  locale: "en" | "pl",
  messages: typeof enMessages,
  props: Parameters<typeof DashboardHome>[0],
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <DashboardHome {...props} />
    </NextIntlClientProvider>,
  );
}

// Oracle: the brand-new-user view (no plan) is the post-auth landing S-05 lands
// on, so it must be the welcome onboarding view (hero + generate CTA + feature
// grid), never the bare returning-user heading, never throw, and never surface
// the has-plan-only glance/sessions.
describe.each([
  { locale: "en" as const, messages: enMessages },
  { locale: "pl" as const, messages: plMessages },
])("DashboardHome ($locale)", ({ locale, messages }) => {
  const t = messages.Dashboard;

  it("renders the welcome onboarding view (hero + generate CTA + features) for a brand-new user", () => {
    renderHome(locale, messages, {
      hasActivePlan: false,
      planGoal: "",
      planSummary: "",
      recentSessions: [],
    });

    // Hero: data-driven eyebrow, value-prop headline (the page h1), subtitle.
    expect(screen.getByText(t.welcomeEyebrow)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: t.welcomeHeadline }),
    ).toBeInTheDocument();
    expect(screen.getByText(t.welcomeSubtitle)).toBeInTheDocument();

    const generate = screen.getByRole("link", { name: t.ctaGenerate });
    expect(generate).toHaveAttribute("href", "/plan/new");

    // Feature grid is mounted (one representative card; full coverage lives in
    // dashboard-feature-grid.test.tsx).
    expect(screen.getByRole("heading", { name: t.featurePrecisionTitle })).toBeInTheDocument();

    // The returning-user heading and the has-plan-only glance/sessions stay out.
    expect(screen.queryByText(t.heading)).not.toBeInTheDocument();
    expect(screen.queryByText(t.planEyebrow)).not.toBeInTheDocument();
    expect(screen.queryByText(t.recentSessionsTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.noSessions)).not.toBeInTheDocument();
  });

  it("renders the plan glance and recent-sessions section for an active plan without crashing on empty goal/summary", () => {
    const sessions: SessionListItem[] = [];

    renderHome(locale, messages, {
      hasActivePlan: true,
      planGoal: "",
      planSummary: "",
      recentSessions: sessions,
    });

    expect(screen.getByRole("heading", { name: t.heading })).toBeInTheDocument();
    // Active plan surfaces the eyebrow + recent-sessions section even when the
    // goal/summary strings are empty (no crash, just no goal/summary lines).
    expect(screen.getByText(t.planEyebrow)).toBeInTheDocument();
    expect(screen.getByText(t.recentSessionsTitle)).toBeInTheDocument();
    expect(screen.getByText(t.noSessions)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.ctaLog })).toHaveAttribute(
      "href",
      "/log-workout",
    );

    // The no-plan welcome hero must not leak into the returning-user view.
    expect(screen.queryByText(t.welcomeEyebrow)).not.toBeInTheDocument();
    expect(screen.queryByText(t.featurePrecisionTitle)).not.toBeInTheDocument();
  });
});

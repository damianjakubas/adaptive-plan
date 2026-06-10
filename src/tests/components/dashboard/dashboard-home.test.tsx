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

// Oracle: the brand-new-user view (no plan, no glance, no sessions) is the
// guardrail S-05 depends on — it must render the heading + the generate CTA
// only, never throw, and never surface the has-plan-only glance/sessions.
describe.each([
  { locale: "en" as const, messages: enMessages },
  { locale: "pl" as const, messages: plMessages },
])("DashboardHome ($locale)", ({ locale, messages }) => {
  const t = messages.Dashboard;

  it("renders the heading and only the generate CTA for a brand-new user", () => {
    renderHome(locale, messages, {
      hasActivePlan: false,
      planGoal: "",
      planSummary: "",
      recentSessions: [],
    });

    expect(screen.getByRole("heading", { name: t.heading })).toBeInTheDocument();

    const generate = screen.getByRole("link", { name: t.ctaGenerate });
    expect(generate).toHaveAttribute("href", "/plan/new");

    // Plan glance + recent-sessions are gated behind hasActivePlan.
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
  });
});

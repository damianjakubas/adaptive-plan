import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DashboardRecentSessions from "@/components/dashboard/dashboard-recent-sessions";
import type { SessionListItem } from "@/db/workout-sessions";
import enMessages from "@/i18n/messages/en.json";
import plMessages from "@/i18n/messages/pl.json";

/** A full SessionListItem with the fields this glance ignores stubbed out. */
function makeSession(
  overrides: Partial<SessionListItem> & Pick<SessionListItem, "id">,
): SessionListItem {
  return {
    durationMinutes: 60,
    muscleGroups: ["Chest"],
    note: null,
    performedAt: new Date(2026, 5, 10, 12, 0, 0),
    sessionName: "Session",
    sessionType: "Mon",
    sourcePlanId: null,
    ...overrides,
  };
}

function renderSessions(
  locale: "en" | "pl",
  messages: typeof enMessages,
  sessions: SessionListItem[],
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <DashboardRecentSessions sessions={sessions} />
    </NextIntlClientProvider>,
  );
}

// Oracle: an empty sessions array must degrade to the localized "no sessions
// yet" line rather than an empty block; a non-empty array lists the sessions
// by name. The section heading is always present in both branches.
describe.each([
  { locale: "en" as const, messages: enMessages },
  { locale: "pl" as const, messages: plMessages },
])("DashboardRecentSessions ($locale)", ({ locale, messages }) => {
  const t = messages.Dashboard;

  it("shows the empty line and no list when there are no sessions", () => {
    renderSessions(locale, messages, []);

    expect(screen.getByText(t.recentSessionsTitle)).toBeInTheDocument();
    expect(screen.getByText(t.noSessions)).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("lists each recent session by name and drops the empty line when sessions exist", () => {
    renderSessions(locale, messages, [
      makeSession({ id: "s1", sessionName: "Upper Strength" }),
      makeSession({ id: "s2", sessionName: "Cardio Intervals" }),
    ]);

    expect(screen.getByText(t.recentSessionsTitle)).toBeInTheDocument();
    expect(screen.getByText("Upper Strength")).toBeInTheDocument();
    expect(screen.getByText("Cardio Intervals")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText(t.noSessions)).not.toBeInTheDocument();
  });
});

import { NextIntlClientProvider } from "next-intl";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Each row now wires in the `HistoryRowActions` client leaf, which calls
// `useRouter()` at the top level — without a `next/navigation` mock React throws
// "invariant expected app router to be mounted" (there is no global mock in
// setup.ts). Stub it so the list renders; the action is stubbed too in case the
// leaf pulls it in at module load. Goal here is render-survival, not new coverage.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/workout/actions", () => ({
  deleteWorkoutSession: vi.fn(),
}));

import HistoryList from "@/components/history/history-list";
import type { SessionListItem } from "@/db/workout-sessions";
import enMessages from "@/i18n/messages/en.json";
import plMessages from "@/i18n/messages/pl.json";

// Fixed clock so relative-day classification is deterministic: noon, 10 Jun 2026.
const NOW = new Date(2026, 5, 10, 12, 0, 0);

/** A full SessionListItem with the unused note/sourcePlanId fields stubbed. */
function makeSession(overrides: Partial<SessionListItem> & Pick<SessionListItem, "id">): SessionListItem {
  return {
    durationMinutes: 60,
    muscleGroups: ["Chest"],
    note: null,
    performedAt: NOW,
    sessionName: "Session",
    sessionType: "Mon",
    sourcePlanId: null,
    ...overrides,
  };
}

// Newest-first, one row per relative-day kind; s2 carries the null-type/empty-
// groups edge case the component must render without a badge or groups line.
function makeSessions(): SessionListItem[] {
  return [
    makeSession({
      durationMinutes: 75,
      id: "s1",
      muscleGroups: ["Chest", "Back"],
      performedAt: new Date(2026, 5, 10, 9, 0, 0), // today
      sessionName: "Upper Strength",
      sessionType: "Mon",
    }),
    makeSession({
      durationMinutes: 45,
      id: "s2",
      muscleGroups: [],
      performedAt: new Date(2026, 5, 9, 18, 0, 0), // yesterday
      sessionName: "Cardio Intervals",
      sessionType: null,
    }),
    makeSession({
      durationMinutes: 90,
      id: "s3",
      muscleGroups: ["Legs"],
      performedAt: new Date(2026, 5, 7, 10, 0, 0), // 3 days back → weekday
      sessionName: "Lower Strength",
      sessionType: "Wed",
    }),
    makeSession({
      durationMinutes: 120,
      id: "s4",
      muscleGroups: ["Arms"],
      performedAt: new Date(2026, 5, 1, 10, 0, 0), // 9 days back → date
      sessionName: "Old Session",
      sessionType: "Sat",
    }),
  ];
}

function renderList(locale: "en" | "pl", messages: typeof enMessages) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <HistoryList now={NOW} sessions={makeSessions()} />
    </NextIntlClientProvider>,
  );
}

describe.each([
  { locale: "en" as const, messages: enMessages },
  { locale: "pl" as const, messages: plMessages },
])("HistoryList ($locale)", ({ locale, messages }) => {
  const t = messages.History;

  it("renders the column headers and one row per session in the given order", () => {
    renderList(locale, messages);

    expect(screen.getByText(t.columnDate)).toBeInTheDocument();
    expect(screen.getByText(t.columnSession)).toBeInTheDocument();
    expect(screen.getByText(t.columnDuration)).toBeInTheDocument();

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(4);
    // Order is preserved exactly — the component must not re-sort.
    expect(within(rows[0]).getByText("Upper Strength")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Cardio Intervals")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Lower Strength")).toBeInTheDocument();
    expect(within(rows[3]).getByText("Old Session")).toBeInTheDocument();
  });

  it("renders the relative-day label over the absolute date for today/yesterday/weekday rows", () => {
    renderList(locale, messages);
    const rows = screen.getAllByRole("listitem");

    // Hardcoded spec strings — verified output of { day:"numeric", month:"short", year:"numeric" }
    // and { weekday:"long" } for each locale. Hardcoding pins the oracle so that changing the
    // format options in the component would fail this test.
    const todayAbsolute = locale === "en" ? "Jun 10, 2026" : "10 cze 2026";
    const weekdayLabel = locale === "en" ? "Sunday" : "niedziela";

    // Today: translated label + absolute date as secondary.
    expect(within(rows[0]).getByText(t.today)).toBeInTheDocument();
    expect(within(rows[0]).getByText(todayAbsolute)).toBeInTheDocument();
    // Yesterday: translated label.
    expect(within(rows[1]).getByText(t.yesterday)).toBeInTheDocument();
    // Weekday (3 days back): locale weekday name as the primary line.
    expect(within(rows[2]).getByText(weekdayLabel)).toBeInTheDocument();
  });

  it("renders the absolute date as the only date line for sessions 7+ days back", () => {
    renderList(locale, messages);
    const rows = screen.getAllByRole("listitem");

    // Hardcoded spec string — pins the { day:"numeric", month:"short", year:"numeric" } oracle.
    const absolute = locale === "en" ? "Jun 1, 2026" : "1 cze 2026";
    // Primary line is the date and there is no secondary date line (single match).
    expect(within(rows[3]).getAllByText(absolute)).toHaveLength(1);
  });

  it("renders the type badge only when sessionType is non-null", () => {
    renderList(locale, messages);
    const rows = screen.getAllByRole("listitem");

    expect(within(rows[0]).getByTestId("session-type-badge")).toHaveTextContent("Mon");
    // s2 has a null type → no badge.
    expect(within(rows[1]).queryByTestId("session-type-badge")).not.toBeInTheDocument();
  });

  it("renders the muscle-groups line only when muscleGroups is non-empty", () => {
    renderList(locale, messages);
    const rows = screen.getAllByRole("listitem");

    expect(within(rows[0]).getByTestId("muscle-groups")).toHaveTextContent("Chest, Back");
    // s2 has empty muscleGroups → no groups line.
    expect(within(rows[1]).queryByTestId("muscle-groups")).not.toBeInTheDocument();
  });

  it("renders no rows when sessions is empty", () => {
    render(
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
        <HistoryList now={NOW} sessions={[]} />
      </NextIntlClientProvider>,
    );
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("renders each duration in the compact 'h/m' notation (locale-independent)", () => {
    renderList(locale, messages);
    const rows = screen.getAllByRole("listitem");

    expect(within(rows[0]).getByText("1h 15m")).toBeInTheDocument();
    expect(within(rows[1]).getByText("45m")).toBeInTheDocument();
    expect(within(rows[2]).getByText("1h 30m")).toBeInTheDocument();
    expect(within(rows[3]).getByText("2h")).toBeInTheDocument();
  });
});

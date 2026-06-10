import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HistoryEmptyState from "@/components/history/history-empty-state";
import enMessages from "@/i18n/messages/en.json";
import plMessages from "@/i18n/messages/pl.json";

function renderEmptyState(
  locale: "en" | "pl",
  messages: typeof enMessages,
  hasActivePlan: boolean,
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <HistoryEmptyState hasActivePlan={hasActivePlan} />
    </NextIntlClientProvider>,
  );
}

describe.each([
  { locale: "en" as const, messages: enMessages },
  { locale: "pl" as const, messages: plMessages },
])("HistoryEmptyState ($locale)", ({ locale, messages }) => {
  const t = messages.History;

  it("points the CTA to /log-workout with log copy when the user has an active plan", () => {
    renderEmptyState(locale, messages, true);

    expect(screen.getByText(t.emptyTitle)).toBeInTheDocument();
    expect(screen.getByText(t.emptyBodyLog)).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: t.emptyCtaLog });
    expect(cta).toHaveAttribute("href", "/log-workout");
  });

  it("points the CTA to /plan/new with plan copy when the user has no active plan", () => {
    renderEmptyState(locale, messages, false);

    expect(screen.getByText(t.emptyTitle)).toBeInTheDocument();
    expect(screen.getByText(t.emptyBodyPlan)).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: t.emptyCtaPlan });
    expect(cta).toHaveAttribute("href", "/plan/new");
  });
});

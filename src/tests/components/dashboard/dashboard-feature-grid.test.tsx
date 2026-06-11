import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DashboardFeatureGrid from "@/components/dashboard/dashboard-feature-grid";
import enMessages from "@/i18n/messages/en.json";
import plMessages from "@/i18n/messages/pl.json";

function renderGrid(locale: "en" | "pl", messages: typeof enMessages) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <DashboardFeatureGrid />
    </NextIntlClientProvider>,
  );
}

// Oracle: the dashboard_og_lny design shows exactly three value-prop cards —
// Precision, Adaptation, Tracking — each with a title and a body. The copy and
// count come from the design + catalogs, not from re-reading the component.
describe.each([
  { locale: "en" as const, messages: enMessages },
  { locale: "pl" as const, messages: plMessages },
])("DashboardFeatureGrid ($locale)", ({ locale, messages }) => {
  const t = messages.Dashboard;

  it("renders exactly the three value-prop cards with their title and body", () => {
    renderGrid(locale, messages);

    // Card titles are level-3 headings; exactly three, no more.
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);

    const cards: [string, string][] = [
      [t.featurePrecisionTitle, t.featurePrecisionBody],
      [t.featureAdaptationTitle, t.featureAdaptationBody],
      [t.featureTrackingTitle, t.featureTrackingBody],
    ];

    for (const [title, body] of cards) {
      expect(screen.getByRole("heading", { level: 3, name: title })).toBeInTheDocument();
      expect(screen.getByText(body)).toBeInTheDocument();
    }
  });
});

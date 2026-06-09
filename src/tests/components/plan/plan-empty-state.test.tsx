import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PlanEmptyState from "@/components/plan/plan-empty-state";
import enMessages from "@/i18n/messages/en.json";

describe("PlanEmptyState", () => {
  it("links to the wizard at /plan/new", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <PlanEmptyState />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(enMessages.Plan.emptyState)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: enMessages.Plan.emptyStateLink });
    expect(link).toHaveAttribute("href", "/plan/new");
  });
});

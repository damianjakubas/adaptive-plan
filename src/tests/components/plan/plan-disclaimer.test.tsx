import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PlanDisclaimer from "@/components/plan/plan-disclaimer";
import enMessages from "@/i18n/messages/en.json";

function renderDisclaimer(disclaimer?: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <PlanDisclaimer disclaimer={disclaimer} />
    </NextIntlClientProvider>,
  );
}

describe("PlanDisclaimer", () => {
  // Safety contract (test-plan §2 Risk #2): a "not medical advice" string must
  // reach the user regardless of LLM output. The load-bearing fallback branch
  // (plan-disclaimer.tsx:14) renders the static i18n message whenever the model
  // omits or empties the field. Oracle is the i18n value, never the component's
  // own expression and never the prompt string (mirror anti-pattern).
  it.each([
    ["undefined", undefined],
    ["empty string", ""],
    ["whitespace only", "   "],
  ])("renders the static i18n fallback when the model disclaimer is %s", (_label, disclaimer) => {
    renderDisclaimer(disclaimer);

    expect(screen.getByText(enMessages.Plan.disclaimerFallback)).toBeInTheDocument();
  });

  it("renders the model-supplied disclaimer verbatim when present", () => {
    const supplied = "This plan is informational only — fixture disclaimer.";
    renderDisclaimer(supplied);

    expect(screen.getByText(supplied)).toBeInTheDocument();
    expect(screen.queryByText(enMessages.Plan.disclaimerFallback)).not.toBeInTheDocument();
  });

  it.each([
    ["undefined", undefined],
    ["empty string", ""],
    ["whitespace only", "   "],
    ["model-supplied", "This plan is informational only — fixture disclaimer."],
  ])("always renders the static i18n title regardless of the disclaimer (%s)", (_label, disclaimer) => {
    renderDisclaimer(disclaimer);

    expect(screen.getByText(enMessages.Plan.disclaimerTitle)).toBeInTheDocument();
  });
});

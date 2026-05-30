import { NextIntlClientProvider } from "next-intl";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// The card imports the server actions; mock them so the test never pulls in
// server-only code (next/headers) and so submits are observable.
vi.mock("@/lib/auth/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

import { AuthCard } from "@/components/auth/auth-card";
import enMessages from "@/i18n/messages/en.json";
import { signIn } from "@/lib/auth/actions";

function renderCard() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <AuthCard />
    </NextIntlClientProvider>,
  );
}

describe("AuthCard", () => {
  it("renders both the sign-in and sign-up tabs", () => {
    renderCard();
    expect(screen.getByRole("tab", { name: enMessages.Auth.loginTab })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: enMessages.Auth.registerTab })).toBeInTheDocument();
  });

  it("shows an inline validation error and does not submit on an invalid email", async () => {
    const user = userEvent.setup();
    renderCard();

    const emailInput = screen.getByPlaceholderText(enMessages.Auth.emailPlaceholder);
    await user.type(emailInput, "not-an-email");
    await user.type(screen.getByPlaceholderText(enMessages.Auth.passwordPlaceholder), "secret");

    // Submit the form directly: jsdom does not perform the submit default action
    // when a submit button is clicked, so RHF's onSubmit validation never runs
    // via user.click. Dispatching the submit event exercises the same handler.
    fireEvent.submit(emailInput.closest("form")!);

    expect(await screen.findByText(enMessages.Validation.invalid_email)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });
});

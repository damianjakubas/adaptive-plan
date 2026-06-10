import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import DeleteConfirmDialog from "@/components/history/delete-confirm-dialog";
import enMessages from "@/i18n/messages/en.json";
import plMessages from "@/i18n/messages/pl.json";

// Radix AlertDialog toggles pointer-events on <body>, which jsdom does not
// model — disable user-event's pointer-events check for dialog interactions
// (mirrors the workout-session-editor test).
function setup(locale: "en" | "pl", messages: typeof enMessages) {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <DeleteConfirmDialog open onClose={onClose} onConfirm={onConfirm} />
    </NextIntlClientProvider>,
  );
  return { onClose, onConfirm, user };
}

describe.each([
  { locale: "en" as const, messages: enMessages },
  { locale: "pl" as const, messages: plMessages },
])("DeleteConfirmDialog ($locale)", ({ locale, messages }) => {
  const t = messages.History;

  it("renders the translated title, body, and buttons", () => {
    setup(locale, messages);

    expect(screen.getByText(t.deleteDialogTitle)).toBeInTheDocument();
    expect(screen.getByText(t.deleteDialogBody)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.deleteDialogConfirm })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.deleteDialogCancel })).toBeInTheDocument();
  });

  it("fires onConfirm when the confirm button is clicked", async () => {
    const { onConfirm, user } = setup(locale, messages);

    await user.click(screen.getByRole("button", { name: t.deleteDialogConfirm }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("fires onClose when the cancel button is clicked", async () => {
    const { onClose, user } = setup(locale, messages);

    await user.click(screen.getByRole("button", { name: t.deleteDialogCancel }));

    expect(onClose).toHaveBeenCalled();
  });
});

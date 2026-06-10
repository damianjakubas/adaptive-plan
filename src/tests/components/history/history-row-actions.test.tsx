import { NextIntlClientProvider } from "next-intl";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/i18n/messages/en.json";

// Hoisted so the vi.mock factories below can reference them before imports resolve.
const mockRefresh = vi.hoisted(() => vi.fn());
const mockDeleteWorkoutSession = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mockRefresh }),
}));

vi.mock("@/lib/workout/actions", () => ({
  deleteWorkoutSession: mockDeleteWorkoutSession,
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

import HistoryRowActions from "@/components/history/history-row-actions";

const t = enMessages.History;
const tErrors = enMessages.WorkoutErrors;

function setup() {
  // Radix AlertDialog toggles pointer-events on <body>, which jsdom does not model.
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(
    <NextIntlClientProvider locale="en" messages={enMessages} timeZone="UTC">
      <HistoryRowActions sessionId="s1" />
    </NextIntlClientProvider>,
  );
  return { user };
}

beforeEach(() => {
  mockRefresh.mockClear();
  mockDeleteWorkoutSession.mockReset();
  toastSuccess.mockClear();
  toastError.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("HistoryRowActions", () => {
  it("renders an Edit link pointing to the session's edit route", () => {
    setup();

    expect(screen.getByRole("link", { name: t.edit })).toHaveAttribute(
      "href",
      "/history/s1/edit",
    );
  });

  it("opens the confirmation dialog when Delete is clicked, without calling the action", async () => {
    const { user } = setup();

    expect(screen.queryByText(t.deleteDialogTitle)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: t.delete }));

    expect(screen.getByText(t.deleteDialogTitle)).toBeInTheDocument();
    expect(mockDeleteWorkoutSession).not.toHaveBeenCalled();
  });

  it("deletes, shows a success toast, and refreshes the list on { ok: true }", async () => {
    mockDeleteWorkoutSession.mockResolvedValue({ ok: true });
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: t.delete }));
    await user.click(screen.getByRole("button", { name: t.deleteDialogConfirm }));

    await waitFor(() => expect(mockDeleteWorkoutSession).toHaveBeenCalledWith("s1"));
    expect(toastSuccess).toHaveBeenCalledWith(t.deleteSuccess);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows an error toast for the returned code and does not refresh on { ok: false }", async () => {
    mockDeleteWorkoutSession.mockResolvedValue({ code: "not_found", ok: false });
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: t.delete }));
    await user.click(screen.getByRole("button", { name: t.deleteDialogConfirm }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(tErrors.not_found));
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("shows the delete_failed toast when the action throws", async () => {
    mockDeleteWorkoutSession.mockRejectedValue(new Error("network"));
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: t.delete }));
    await user.click(screen.getByRole("button", { name: t.deleteDialogConfirm }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(tErrors.delete_failed));
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

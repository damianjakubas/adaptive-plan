import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted so vi.mock factories can reference them before imports resolve.
const mockRefresh = vi.hoisted(() => vi.fn());
const mockSetLocaleCookie = vi.hoisted(() => vi.fn());

vi.mock("next-intl", () => ({
  useLocale: () => "en",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("@/i18n/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/config")>();
  return {
    ...actual,
    setLocaleCookie: mockSetLocaleCookie,
  };
});

import { LocaleToggle } from "@/components/locale-toggle";

beforeEach(() => {
  mockRefresh.mockClear();
  mockSetLocaleCookie.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("LocaleToggle", () => {
  it("writes the cookie and calls router.refresh when switching to the inactive locale", async () => {
    const user = userEvent.setup();
    render(<LocaleToggle />);

    // Active locale is "en"; "pl" is the inactive button.
    await user.click(screen.getByRole("button", { name: "pl" }));

    expect(mockSetLocaleCookie).toHaveBeenCalledWith("pl");
    expect(mockSetLocaleCookie).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when clicking the already-active locale (same-locale guard)", async () => {
    const user = userEvent.setup();
    render(<LocaleToggle />);

    // Active locale is "en"; clicking "en" again must not write the cookie or refresh.
    await user.click(screen.getByRole("button", { name: "en" }));

    expect(mockSetLocaleCookie).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("marks the active locale button as aria-pressed=true and the inactive as false", () => {
    render(<LocaleToggle />);

    // Active locale is "en".
    expect(screen.getByRole("button", { name: "en" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "pl" })).toHaveAttribute("aria-pressed", "false");
  });
});

"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";
import { locales, setLocaleCookie, type Locale } from "@/i18n/config";

export function LocaleToggle({ className }: { className?: string }) {
  const active = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setLocale(next: Locale) {
    if (next === active) return;
    setLocaleCookie(next);
    startTransition(() => router.refresh());
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-outline-variant/50 bg-surface-container/60 p-1 backdrop-blur",
        className
      )}
      role="group"
      aria-label="Language"
    >
      {locales.map((locale) => {
        const isActive = locale === active;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => setLocale(locale)}
            aria-pressed={isActive}
            disabled={isPending}
            className={cn(
              "rounded-full px-3 py-1 font-label-md text-label-md uppercase transition-colors disabled:opacity-50",
              isActive
                ? "bg-primary-container text-on-primary-container"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            {locale}
          </button>
        );
      })}
    </div>
  );
}

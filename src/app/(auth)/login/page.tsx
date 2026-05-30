import { getTranslations } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";

/**
 * Split-screen login / register page realizing `logowanie_rejestracja/code.html`:
 * a branding panel (desktop only) beside a glassmorphism auth card. All copy is
 * localized via next-intl. OAuth buttons and the forgot-password link are omitted.
 */
export default async function LoginPage() {
  const t = await getTranslations("Auth");
  const tCommon = await getTranslations("Common");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col overflow-hidden rounded-xl shadow-2xl md:min-h-[600px] md:flex-row">
      {/* Branding panel — hidden on mobile */}
      <div className="hidden flex-col justify-between border-r border-outline-variant/30 bg-surface-container p-12 md:flex md:w-1/2">
        <div>
          <span className="font-headline-md text-headline-md text-primary-container">
            {tCommon("appName")}
          </span>
          <h1 className="mt-8 max-w-xs font-headline-lg text-headline-lg leading-tight text-primary">
            {t("brandHeadline")}
          </h1>
          <p className="mt-4 max-w-sm font-body-md text-body-md text-on-surface-variant">
            {t("brandSubtitle")}
          </p>
        </div>
      </div>

      {/* Auth card panel */}
      <div className="glass-panel flex w-full flex-col justify-center p-8 md:w-1/2 md:p-12">
        <AuthCard />
      </div>
    </div>
  );
}

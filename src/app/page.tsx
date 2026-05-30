import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LocaleToggle } from "@/components/locale-toggle";

export default async function Home() {
  const t = await getTranslations("Common");
  const tAuth = await getTranslations("Auth");

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-stack-lg bg-background px-container-margin text-center">
      <header className="absolute right-container-margin top-container-margin">
        <LocaleToggle />
      </header>

      <h1 className="font-headline-xl text-headline-xl text-on-surface">
        {t("appName")}
      </h1>
      <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
        {tAuth("brandSubtitle")}
      </p>

      <Link
        href="/login"
        className="btn-glow inline-flex h-12 items-center justify-center rounded-md bg-primary-container px-8 font-label-md text-label-md uppercase text-on-primary-container transition-all active:scale-[0.98]"
      >
        {tAuth("loginTab")}
      </Link>
    </main>
  );
}

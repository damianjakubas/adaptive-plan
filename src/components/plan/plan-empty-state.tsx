"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/** Shown on `/plan` when the user has no active plan — links to the wizard. */
function PlanEmptyState() {
  const t = useTranslations("Plan");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-stack-md py-stack-lg text-center">
      <p className="font-body-lg text-body-lg text-on-surface-variant">{t("emptyState")}</p>
      <Button asChild>
        <Link href="/plan/new">{t("emptyStateLink")}</Link>
      </Button>
    </div>
  );
}

export default PlanEmptyState;

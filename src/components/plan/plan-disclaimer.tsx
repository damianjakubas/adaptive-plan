"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Mandatory not-medical-advice disclaimer (PRD guardrail). Renders the model's
 * `disclaimer` text, falling back to a localized default if the model omitted it.
 */
function PlanDisclaimer({ disclaimer }: Props) {
  const t = useTranslations("Plan");
  const text = disclaimer?.trim() ? disclaimer : t("disclaimerFallback");

  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle>{t("disclaimerTitle")}</AlertTitle>
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  );
}

interface Props {
  disclaimer?: string;
}

export default PlanDisclaimer;

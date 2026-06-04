"use client";

import { experimental_useObject as useObject } from "@ai-sdk/react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import GenerationLoader from "@/components/plan/generation-loader";
import ParameterForm from "@/components/plan/parameter-form";
import PlanView from "@/components/plan/plan-view";
import { mapPlanError } from "@/lib/plan/errors";
import { planOutputSchema, type GeneratedPlan, type PlanInput } from "@/lib/validation/plan-schema";

/**
 * Smart client component tying the wizard, the streaming hook, the loader, and the
 * result view into the end-to-end US-01 flow.
 *
 * On successful completion we render `plan-view` in place directly from the
 * client-held final object surfaced by `useObject`'s `onFinish({ object })` — we do
 * NOT navigate to `/plan` and re-read the DB. The server-side `onFinish` write (route
 * handler) is the *durable* copy; it commits strictly after the stream is consumed, so
 * navigating here would read `getActivePlan` before the write lands (read-after-write
 * race). Rendering from the final object also keeps this surface off the streaming
 * `DeepPartial`. The `/plan` page remains the from-DB entry point for cold loads.
 *
 * The form unmounts while loading / on success (no `reset()`, sidesteps RHF #13110).
 * On error we map to a `PlanErrorCode`, toast it, and fall back to the form with the
 * submitted values preserved.
 */
function PlanGenerator() {
  const tErrors = useTranslations("PlanErrors");
  const [finalPlan, setFinalPlan] = useState<GeneratedPlan | null>(null);
  const [submittedValues, setSubmittedValues] = useState<PlanInput | undefined>(undefined);

  const { error, isLoading, submit } = useObject({
    api: "/api/plan/generate",
    onFinish: ({ error: finishError, object }) => {
      if (object && !finishError) {
        setFinalPlan(object);
      }
    },
    schema: planOutputSchema,
  });

  useEffect(() => {
    if (error) {
      toast.error(tErrors(mapPlanError(error)));
    }
  }, [error, tErrors]);

  if (finalPlan) {
    return <PlanView plan={finalPlan} />;
  }

  if (isLoading) {
    return <GenerationLoader />;
  }

  return (
    <ParameterForm
      initialValues={submittedValues}
      onGenerate={(values) => {
        setSubmittedValues(values);
        submit(values);
      }}
    />
  );
}

export default PlanGenerator;

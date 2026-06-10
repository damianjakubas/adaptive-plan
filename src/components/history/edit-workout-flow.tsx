"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { WorkoutSessionEditor } from "@/components/workout";
import type { WorkoutSessionFormInput } from "@/lib/validation/workout-session-form-schema";
import { updateWorkoutSession } from "@/lib/workout/actions";

/**
 * The picker-less twin of `LogWorkoutFlow` (S-03 / FR-020): renders the shared
 * editor on a mapped saved snapshot, persists edits via `updateWorkoutSession`
 * (which preserves the original `performedAt` + `sourcePlanId` server-side, so
 * editing never reorders history), and routes back to `/history`. Same
 * `{ ok, code }` action consumption as the log flow — the client owns toast +
 * navigation.
 */
function EditWorkoutFlow({ defaultValues, sessionId }: Props) {
  const t = useTranslations("History");
  const tErrors = useTranslations("WorkoutErrors");
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  return (
    <WorkoutSessionEditor
      defaultValues={defaultValues}
      saving={saving}
      onDiscard={() => router.push("/history")}
      onSave={async (values) => {
        setSaving(true);
        try {
          const result = await updateWorkoutSession(sessionId, values);
          if (result.ok) {
            toast.success(t("updateSuccess"));
            router.push("/history");
            return;
          }
          toast.error(tErrors(result.code));
        } catch {
          // The action maps failures to codes; reaching here means the request
          // never completed (network / aborted RSC call).
          toast.error(tErrors("save_failed"));
        }
        setSaving(false);
      }}
    />
  );
}

interface Props {
  defaultValues: WorkoutSessionFormInput;
  sessionId: string;
}

export default EditWorkoutFlow;

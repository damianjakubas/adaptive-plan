"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { GeneratedPlan } from "@/lib/validation/plan-schema";
import { saveWorkoutSession } from "@/lib/workout/actions";
import mapPlanDayToFormValues from "@/lib/workout/map-plan-day-to-form-values";
import DayPicker from "./day-picker";
import WorkoutSessionEditor from "./workout-session-editor";

/**
 * The one stateful client piece of `/log-workout`: filters the plan's loggable
 * days, holds the picked day, maps it to form values, hands them to the shared
 * editor, and owns the save-action call plus toast + navigation (auth-card
 * pattern — the action returns `{ ok, code }`, the client renders feedback).
 */
function LogWorkoutFlow({ weeklySchedule }: Props) {
  const t = useTranslations("LogWorkout");
  const tErrors = useTranslations("WorkoutErrors");
  const router = useRouter();
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const loggableDays = weeklySchedule.filter(
    (day) => !day.isRest && (day.exercises?.length ?? 0) > 0
  );

  if (loggableDays.length === 0) {
    return (
      <p className="py-stack-lg text-center font-body-lg text-body-lg text-on-surface-variant">
        {t("noLoggableDays")}
      </p>
    );
  }

  if (pickedIndex === null) {
    return (
      <DayPicker
        days={loggableDays.map((day) => ({
          day: day.day,
          exerciseCount: day.exercises?.length ?? 0,
          focus: day.focus,
        }))}
        onPick={setPickedIndex}
      />
    );
  }

  return (
    <WorkoutSessionEditor
      defaultValues={mapPlanDayToFormValues(loggableDays[pickedIndex])}
      saving={saving}
      onDiscard={() => router.push("/plan")}
      onSave={async (values) => {
        setSaving(true);
        try {
          const result = await saveWorkoutSession(values);
          if (result.ok) {
            toast.success(t("saveSuccess"));
            router.push("/plan");
            return;
          }
          toast.error(tErrors(result.code));
        } catch {
          // The action itself maps failures to codes; reaching here means the
          // request never completed (network / aborted RSC call).
          toast.error(tErrors("save_failed"));
        }
        setSaving(false);
      }}
    />
  );
}

interface Props {
  weeklySchedule: GeneratedPlan["weeklySchedule"];
}

export default LogWorkoutFlow;

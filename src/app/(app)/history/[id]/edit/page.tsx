import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { EditWorkoutFlow } from "@/components/history";
import { getSessionById } from "@/db/workout-sessions";
import { getUser } from "@/lib/supabase/get-user";
import mapSessionToFormValues from "@/lib/workout/map-session-to-form-values";

export async function generateMetadata() {
  const t = await getTranslations("History");
  return { title: t("editPageTitle") };
}

/**
 * Authenticated `/history/[id]/edit` page (US-02, FR-020): server gate,
 * owner-scoped fetch of the full session tree, redirect on miss/forge, then hand
 * the mapped snapshot to the client flow. Mirror of `/log-workout/page.tsx` —
 * minus the active-plan gate, since editing must work after the plan changed or
 * was removed. A `null` session (missing or not owned) bounces to `/history`, so
 * no separate ownership branch is needed.
 */
export default async function EditWorkoutPage({ params }: Props) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const session = await getSessionById(user.id, id);

  if (!session) {
    redirect("/history");
  }

  const t = await getTranslations("History");

  return (
    <div className="container mx-auto max-w-3xl px-container-margin py-12">
      <div className="mb-8 space-y-2 text-center">
        <p className="font-label-md text-label-md uppercase tracking-wider text-primary-container">
          {t("eyebrow")}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{t("editPageTitle")}</h1>
      </div>
      <EditWorkoutFlow defaultValues={mapSessionToFormValues(session)} sessionId={session.id} />
    </div>
  );
}

interface Props {
  params: Promise<{ id: string }>;
}

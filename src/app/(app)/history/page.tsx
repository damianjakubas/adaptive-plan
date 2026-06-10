import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { HistoryEmptyState, HistoryList } from "@/components/history";
import { hasActivePlan } from "@/db/plans";
import { listSessions } from "@/db/workout-sessions";
import { getUser } from "@/lib/supabase/get-user";

export async function generateMetadata() {
  const t = await getTranslations("Nav");
  return { title: t("history") };
}

/**
 * Authenticated `/history` page (US-02, FR-018): server gate + data load, minimal
 * JSX. With no logged sessions it renders the plan-state-aware empty state
 * (`hasActivePlan` queried only on this branch); otherwise the page header plus
 * the presentational `HistoryList` (newest-first ordering is `listSessions`'
 * contract — the component never re-sorts).
 */
export default async function HistoryPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const sessions = await listSessions(user.id);

  if (sessions.length === 0) {
    const activePlan = await hasActivePlan(user.id);
    return <HistoryEmptyState hasActivePlan={activePlan} />;
  }

  const t = await getTranslations("History");

  return (
    <div className="container mx-auto max-w-5xl px-container-margin py-12">
      <div className="mb-8 space-y-2">
        <p className="font-label-md text-label-md uppercase tracking-wider text-primary-container">
          {t("eyebrow")}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">{t("subtitle")}</p>
      </div>
      <HistoryList now={new Date()} sessions={sessions} />
    </div>
  );
}

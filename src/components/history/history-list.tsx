import { Calendar, Timer } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import type { SessionListItem } from "@/db/workout-sessions";
import formatDuration from "@/lib/history/format-duration";
import getRelativeDay from "@/lib/history/relative-day";
import HistoryRowActions from "./history-row-actions";

/**
 * Presentational, sync server component rendering the `historia_trening_w`
 * mockup's history panel minus its out-of-scope controls (search, filter,
 * load-more). Each row carries an Edit link + Delete trigger via the
 * `HistoryRowActions` client leaf — the list itself stays a sync server
 * component (the leaf is the only client JS). One row per session, in the order
 * given — the component never re-sorts; newest-first ordering is `listSessions`'
 * contract.
 *
 * Uses next-intl shared-component hooks (`useTranslations`/`useFormatter`)
 * without `"use client"` (see lessons.md carve-out): ships no client JS yet
 * renders synchronously under `NextIntlClientProvider` in RTL tests. The
 * relative-day label is derived once per row; the absolute date is the
 * secondary line except when the primary already is the date (≥7 days / future).
 */
function HistoryList({ now, sessions }: Props) {
  const t = useTranslations("History");
  const format = useFormatter();

  return (
    <div className="overflow-hidden rounded-lg border border-surface-container-highest">
      <div className="hidden grid-cols-12 gap-4 border-b border-surface-container-highest bg-surface-container-low px-6 py-4 font-label-md text-label-md uppercase tracking-wider text-on-surface-variant md:grid">
        <div className="col-span-3">{t("columnDate")}</div>
        <div className="col-span-5">{t("columnSession")}</div>
        <div className="col-span-2 text-right">{t("columnDuration")}</div>
        <div className="col-span-2" aria-hidden="true" />
      </div>
      <ul className="flex flex-col">
        {sessions.map((session) => {
          const kind = getRelativeDay(session.performedAt, now);
          const absoluteDate = format.dateTime(session.performedAt, {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
          const primaryLabel =
            kind === "today"
              ? t("today")
              : kind === "yesterday"
                ? t("yesterday")
                : kind === "weekday"
                  ? format.dateTime(session.performedAt, { weekday: "long" })
                  : absoluteDate;

          return (
            <li
              key={session.id}
              className="flex flex-col gap-4 border-b border-surface-container-highest px-6 py-5 last:border-b-0 md:grid md:grid-cols-12 md:items-center"
            >
              <div className="col-span-3 flex items-center gap-3 text-on-surface">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-surface-container-highest bg-surface">
                  <Calendar className="size-5 text-on-surface-variant" />
                </div>
                <div>
                  <div className="font-body-md text-body-md font-semibold">{primaryLabel}</div>
                  {kind !== "date" && (
                    <div className="font-label-md text-label-md text-on-surface-variant">
                      {absoluteDate}
                    </div>
                  )}
                </div>
              </div>

              <div className="col-span-5">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-body-md text-body-md font-semibold text-on-surface">
                    {session.sessionName}
                  </span>
                  {session.sessionType && (
                    <span
                      data-testid="session-type-badge"
                      className="inline-block rounded-full border border-surface-container-highest bg-surface-container-high px-2 py-0.5 font-label-md text-label-md uppercase text-on-surface-variant"
                    >
                      {session.sessionType}
                    </span>
                  )}
                </div>
                {session.muscleGroups.length > 0 && (
                  <div
                    data-testid="muscle-groups"
                    className="line-clamp-1 font-label-md text-label-md text-on-surface-variant"
                  >
                    {session.muscleGroups.join(", ")}
                  </div>
                )}
              </div>

              <div className="col-span-2 flex items-center justify-between text-on-surface-variant md:justify-end">
                <span className="font-label-md text-label-md md:hidden">
                  {t("durationMobileLabel")}
                </span>
                <span className="flex items-center gap-1">
                  <Timer className="size-4" />
                  <span className="font-body-md text-body-md">
                    {formatDuration(session.durationMinutes)}
                  </span>
                </span>
              </div>

              <div className="col-span-2 flex md:justify-end">
                <HistoryRowActions sessionId={session.id} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface Props {
  now: Date;
  sessions: SessionListItem[];
}

export default HistoryList;

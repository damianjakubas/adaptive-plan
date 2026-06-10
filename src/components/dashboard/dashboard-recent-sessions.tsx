import { Timer } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import type { SessionListItem } from "@/db/workout-sessions";
import formatDuration from "@/lib/history/format-duration";

/**
 * Compact glance at the user's most recent sessions for the welcome dashboard.
 * Accepts the same `SessionListItem[]` prop shape `HistoryList` does (the page
 * just slices to 2–3 and passes them through — no bespoke view-subset type) and
 * reads only `id`/`performedAt`/`sessionName`/`durationMinutes`.
 *
 * Duration formatting reuses the existing `formatDuration` history helper rather
 * than a new dashboard helper (DRY / convention rule 9); the date is a single
 * inline `useFormatter().dateTime(...)` call (convention rule 9 carve-out) — no
 * relative-day labels here, so no extra i18n keys beyond the locked Phase 1 set.
 * Sync `useTranslations` shared-component pattern, no `"use client"`
 * (lessons.md carve-out).
 *
 * Empty array → the localized "no sessions yet" line, not an empty block.
 */
function DashboardRecentSessions({ sessions }: Props) {
  const t = useTranslations("Dashboard");
  const format = useFormatter();

  return (
    <section className="space-y-stack-sm">
      <h2 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">
        {t("recentSessionsTitle")}
      </h2>

      {sessions.length === 0 ? (
        <p className="font-body-md text-body-md text-on-surface-variant">{t("noSessions")}</p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-surface-container-highest">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-center justify-between gap-4 border-b border-surface-container-highest px-4 py-3 last:border-b-0"
            >
              <div>
                <div className="font-body-md text-body-md font-semibold text-on-surface">
                  {session.sessionName}
                </div>
                <div className="font-label-md text-label-md text-on-surface-variant">
                  {format.dateTime(session.performedAt, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
              <span className="flex items-center gap-1 text-on-surface-variant">
                <Timer className="size-4" />
                <span className="font-body-md text-body-md">
                  {formatDuration(session.durationMinutes)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface Props {
  sessions: SessionListItem[];
}

export default DashboardRecentSessions;

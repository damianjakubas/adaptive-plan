"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteWorkoutSession } from "@/lib/workout/actions";
import DeleteConfirmDialog from "./delete-confirm-dialog";

/**
 * The single client leaf of the history tree (CLAUDE.md rule 10 / view-history
 * lesson — `HistoryList` stays a sync server component). Holds the per-row Edit
 * link and the Delete trigger plus its confirmation-dialog state. Mirrors
 * `LogWorkoutFlow`'s action consumption: the server action returns `{ ok, code }`,
 * the client renders toast feedback and reconciles the list with
 * `router.refresh()` (single server source of truth, no client list state).
 */
function HistoryRowActions({ sessionId }: Props) {
  const t = useTranslations("History");
  const tErrors = useTranslations("WorkoutErrors");
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button asChild size="sm" variant="outline">
        <Link href={`/history/${sessionId}/edit`}>
          <Pencil />
          {t("edit")}
        </Link>
      </Button>
      <Button
        disabled={deleting}
        onClick={() => setConfirmOpen(true)}
        size="sm"
        variant="destructive"
      >
        <Trash2 />
        {t("delete")}
      </Button>
      <DeleteConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          setConfirmOpen(false);
          setDeleting(true);
          try {
            const result = await deleteWorkoutSession(sessionId);
            if (result.ok) {
              toast.success(t("deleteSuccess"));
              router.refresh();
              return;
            }
            toast.error(tErrors(result.code));
          } catch {
            // The action maps failures to codes; reaching here means the request
            // never completed (network / aborted RSC call).
            toast.error(tErrors("delete_failed"));
          }
          setDeleting(false);
        }}
      />
    </div>
  );
}

interface Props {
  sessionId: string;
}

export default HistoryRowActions;

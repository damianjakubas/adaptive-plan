"use client";

import { useTranslations } from "next-intl";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Permanent-delete confirmation (FR-021 — the only safeguard before a session is
 * gone for good). Dumb wrapper over the shadcn alert-dialog mirroring
 * `discard-dialog.tsx`; the row actions cell owns the open state. The confirm
 * button is styled destructive to signal irreversibility.
 */
function DeleteConfirmDialog({ onClose, onConfirm, open }: Props) {
  const t = useTranslations("History");

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteDialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteDialogBody")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>{t("deleteDialogCancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t("deleteDialogConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface Props {
  /** Fires on every close — cancel button, ESC, overlay click, and the
   * auto-close right after `onConfirm` — so attach close-state logic only. */
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
}

export default DeleteConfirmDialog;

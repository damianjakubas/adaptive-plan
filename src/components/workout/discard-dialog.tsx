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
 * Dirty-form discard confirmation (planning decision: confirm only on the
 * discard click — no router or beforeunload guard). Dumb wrapper over the
 * shadcn alert-dialog; the editor owns the open state.
 */
function DiscardDialog({ onCancel, onConfirm, open }: Props) {
  const t = useTranslations("LogWorkout");

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("discardDialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("discardDialogBody")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{t("discardDialogCancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t("discardDialogConfirm")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface Props {
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
}

export default DiscardDialog;

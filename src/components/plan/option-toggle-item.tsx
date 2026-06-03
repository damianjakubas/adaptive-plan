"use client";

import type { ReactNode } from "react";

import { ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/**
 * Dumb wrapper over shadcn `ToggleGroupItem` that pre-applies the "selectable card"
 * styling so every single-choice option button across the parameter form reads the
 * same way (DRY). Uses the outline toggle variant and the existing design tokens
 * (`primary-container`, `primary`) for an obvious selected state.
 */
function OptionToggleItem({ children, className, value }: Props) {
  return (
    <ToggleGroupItem
      className={cn(
        "h-auto rounded-lg px-4 py-2",
        "data-[state=on]:border-primary-container data-[state=on]:bg-primary-container/15 data-[state=on]:text-primary",
        className,
      )}
      value={value}
      variant="outline"
    >
      {children}
    </ToggleGroupItem>
  );
}

interface Props {
  children: ReactNode;
  className?: string;
  value: string;
}

export default OptionToggleItem;

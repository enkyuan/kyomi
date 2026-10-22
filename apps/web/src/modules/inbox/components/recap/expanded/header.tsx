"use client";

import { Minimize2Icon } from "@kyomi/ui/icons/blode";
import { Button } from "@kyomi/ui/components/button";
import { RailTooltip } from "../sections";

export function ExpandedViewHeader({
  backLabel,
  title,
  onBack,
}: {
  backLabel: string;
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="mb-3 flex h-7 shrink-0 items-center justify-between gap-2 px-4">
      <h3 className="min-w-0 truncate font-semibold text-base">{title}</h3>
      <RailTooltip label={backLabel}>
        <Button aria-label={backLabel} size="icon-xs" variant="ghost" onClick={onBack}>
          <Minimize2Icon />
        </Button>
      </RailTooltip>
    </div>
  );
}

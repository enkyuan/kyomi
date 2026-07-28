"use client";

import { LeftFill } from "@kyomi/ui/icons/mingcute";
import { Button } from "@kyomi/ui/atoms/button";
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
    <div className="mb-3 flex h-7 shrink-0 items-center gap-1 px-4">
      <RailTooltip label={backLabel}>
        <Button aria-label={backLabel} size="icon-xs" variant="ghost" onClick={onBack}>
          <LeftFill />
        </Button>
      </RailTooltip>
      <h3 className="min-w-0 truncate font-semibold text-base">{title}</h3>
    </div>
  );
}

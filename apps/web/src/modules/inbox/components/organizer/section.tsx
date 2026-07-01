"use client";

import { TimeDurationFill } from "@mingcute/react";
import type { ReactElement, ReactNode } from "react";
import { Button } from "@kyomi/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@kyomi/ui/empty";
import { Skeleton } from "@kyomi/ui/skeleton";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/tooltip";

export function RailTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

export function OrganizerSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-2 flex h-7 items-center gap-2 px-1 text-muted-foreground text-xs uppercase tracking-normal">
        {icon}
        <h3 className="font-medium">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function SectionEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Empty className="min-h-0 flex-none gap-3 rounded-md border border-dashed px-3 py-5">
      <EmptyHeader>
        <EmptyTitle className="text-sm">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

export function OrganizerSkeleton() {
  return (
    <div className="space-y-7 px-4 py-4">
      {["folders", "sources", "saved"].map((section) => (
        <div key={section} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function OrganizerError({ onRetry }: { onRetry: () => void }) {
  return (
    <Empty className="px-4 py-10">
      <EmptyMedia variant="icon">
        <TimeDurationFill />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle className="text-base">Organizer unavailable</EmptyTitle>
        <EmptyDescription>The rail could not load. Try refreshing it.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </EmptyContent>
    </Empty>
  );
}

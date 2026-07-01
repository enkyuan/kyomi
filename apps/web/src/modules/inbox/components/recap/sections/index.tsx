"use client";

import { FolderWarningFill } from "@mingcute/react";
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

export function RecapSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-visible px-4">
      <div className="mb-3 flex h-7 shrink-0 items-center gap-1">
        <h3 className="min-w-0 truncate font-semibold text-base">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SectionEmpty({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Empty className="min-h-0 flex-none gap-3 rounded-2xl border border-dashed bg-muted/20 px-4 py-6">
      {icon ? (
        <EmptyMedia className="mb-0 text-muted-foreground/80" variant="icon">
          {icon}
        </EmptyMedia>
      ) : null}
      <EmptyHeader>
        <EmptyTitle className="text-sm">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

export function RecapSkeleton() {
  return (
    <div className="grid h-full grid-rows-3 gap-4 px-4 py-4">
      <div className="min-h-0 space-y-2.5 overflow-hidden">
        <Skeleton className="h-5 w-24" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full rounded-xl" />
        ))}
      </div>
      <div className="min-h-0 space-y-2 overflow-hidden">
        <Skeleton className="h-5 w-28" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex gap-2.5 rounded-xl px-2 py-1.5">
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-full" />
            </div>
            <Skeleton className="size-7 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-hidden">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-2 rounded-xl px-2 py-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecapError({ onRetry }: { onRetry: () => void }) {
  return (
    <Empty className="px-6 py-10">
      <EmptyMedia variant="icon">
        <FolderWarningFill />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle className="text-base">Recap paused</EmptyTitle>
        <EmptyDescription>
          Folders, top sources, and saved reminders could not load right now.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </EmptyContent>
    </Empty>
  );
}

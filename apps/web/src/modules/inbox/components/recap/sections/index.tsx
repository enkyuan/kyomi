"use client";

import { FolderWarningFill } from "@kyomi/ui/icons/mingcute";
import type { ReactElement, ReactNode } from "react";
import { Button } from "@kyomi/ui/atoms/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@kyomi/ui/atoms/empty";
import { Skeleton } from "@kyomi/ui/atoms/skeleton";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/atoms/tooltip";
import { cn } from "@kyomi/ui/lib/utils";

export const RECAP_SUMMARY_LAYOUT_CLASS =
  "grid min-h-0 w-full min-w-0 flex-1 grid-rows-3 gap-6 overflow-hidden py-4";
export const RECAP_SUMMARY_SECTION_CLASS =
  "flex h-full min-h-0 w-full min-w-0 flex-col overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]";

export function RailTooltip({ label, children }: { label: string; children: ReactElement }) {
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
    <section className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-visible px-4">
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
    <Empty className="min-h-0 w-full gap-3 px-4 py-6 md:py-6">
      <EmptyHeader className="gap-3">
        {icon ? (
          <EmptyMedia className="mb-0 text-muted-foreground/80" variant="icon">
            {icon}
          </EmptyMedia>
        ) : null}
        <div>
          <EmptyTitle className="text-sm">{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </div>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

export function RecapSkeleton() {
  return (
    <div className={RECAP_SUMMARY_LAYOUT_CLASS}>
      <div className={cn(RECAP_SUMMARY_SECTION_CLASS, "px-4")}>
        <div className="mb-3 flex h-7 shrink-0 items-center">
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-11 w-full rounded-xl" />
          ))}
        </div>
        <div aria-hidden="true" className="mt-auto h-[52px] shrink-0" />
      </div>
      <div className={cn(RECAP_SUMMARY_SECTION_CLASS, "px-4")}>
        <div className="mb-3 flex h-7 shrink-0 items-center">
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="-mx-1 flex min-w-0 items-center gap-2.5 rounded-[15px] p-2">
              <Skeleton className="size-9 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-full" />
              </div>
              <div aria-hidden="true" className="size-7 shrink-0" />
            </div>
          ))}
        </div>
      </div>
      <div className={cn(RECAP_SUMMARY_SECTION_CLASS, "px-4")}>
        <div className="mb-3 flex h-7 shrink-0 items-center">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="-mx-1 h-[60px] space-y-1 rounded-xl px-2 py-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RecapError({ onRetry }: { onRetry: () => void }) {
  return (
    <Empty className="h-full w-full overflow-y-auto px-6 py-10 [scrollbar-gutter:stable] md:py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderWarningFill />
        </EmptyMedia>
        <EmptyTitle className="text-base">Recap unavailable</EmptyTitle>
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

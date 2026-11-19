"use client";

import { TriangleAlertIcon } from "@kyomi/ui/icons/blode";
import type { ReactElement, ReactNode } from "react";
import { Button } from "@kyomi/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@kyomi/ui/components/empty";
import { Skeleton } from "@kyomi/ui/components/skeleton";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/components/tooltip";

/**
 * Spacing is one 8px step: a section card is inset 8px from the rail, sits 8px from the next card,
 * and pads its contents by 8px. Its 24px corner is then concentric with the 16px corner of the
 * rows inside (24 = 16 + 8), and a header's text lines up with a row's text (8px card + 8px own).
 */
export const RECAP_SUMMARY_LAYOUT_CLASS = "flex w-full min-w-0 flex-col gap-4.5 px-2 pt-4.5";
export const RECAP_SUMMARY_SECTION_CLASS =
  "flex w-full min-w-0 shrink-0 flex-col rounded-3xl bg-sidebar p-2";

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
    <section className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="mb-2 flex h-6 shrink-0 items-center justify-between gap-2 px-2">
        <h3 className="min-w-0 truncate font-medium text-muted-foreground text-sm">{title}</h3>
        {action ? (
          <div className="ms-auto flex shrink-0 items-center justify-end">{action}</div>
        ) : null}
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
    <Empty className="w-full py-4" size="sm">
      <EmptyHeader>
        {icon ? (
          <EmptyMedia className="text-muted-foreground/80" variant="icon">
            {icon}
          </EmptyMedia>
        ) : null}
        <div>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription className="mx-auto max-w-full text-pretty">
            {description}
          </EmptyDescription>
        </div>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

export function RecapSkeleton() {
  return (
    <div className={RECAP_SUMMARY_LAYOUT_CLASS}>
      <div className={RECAP_SUMMARY_SECTION_CLASS}>
        <div className="mb-2 flex h-6 shrink-0 items-center px-2">
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex min-w-0 items-center gap-2.5 rounded-2xl p-2">
              <Skeleton className="size-9 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="mt-auto h-[52px] shrink-0" />
      </div>
      <div className={RECAP_SUMMARY_SECTION_CLASS}>
        <div className="mb-2 flex h-6 shrink-0 items-center px-2">
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex min-w-0 items-center gap-2.5 rounded-2xl p-2">
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
      <div className={RECAP_SUMMARY_SECTION_CLASS}>
        <div className="mb-2 flex h-6 shrink-0 items-center px-2">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-[60px] space-y-1 rounded-xl px-2 py-2">
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
    <Empty className="h-full w-full overflow-hidden" size="md">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>Recap unavailable</EmptyTitle>
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

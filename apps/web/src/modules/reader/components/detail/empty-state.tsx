"use client";

import { EmptyStateIcon } from "@kyomi/ui/icons/empty-state";

const EMPTY_STATE_BODY_COPY =
  "Stories from your feeds appear here so you can preview them before opening the original source.";

export function EmptyState() {
  return (
    <div className="flex h-full min-h-72 w-full flex-col items-center justify-center gap-5 px-6 py-10 text-center">
      <EmptyStateIcon className="size-40 shrink-0 sm:size-44" size={176} />
      <div className="w-full max-w-136 space-y-2">
        <p className="text-base font-semibold text-foreground">Select an item to start reading</p>
        <p className="mx-auto max-w-110 text-balance text-sm leading-6 text-muted-foreground">
          {EMPTY_STATE_BODY_COPY}
        </p>
      </div>
    </div>
  );
}

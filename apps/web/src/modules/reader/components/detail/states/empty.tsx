"use client";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@kyomi/ui/components/empty";
import { EmptyStateIcon } from "@kyomi/ui/icons/empty-state";

const EMPTY_STATE_BODY_COPY =
  "Stories from your feeds appear here so you can preview them before opening the original source.";

export function EmptyState() {
  return (
    <Empty className="h-full w-full" size="md">
      <EmptyHeader>
        <EmptyMedia variant="illustration">
          <EmptyStateIcon size={176} />
        </EmptyMedia>
        <EmptyTitle>Select an item to start reading</EmptyTitle>
        <EmptyDescription>{EMPTY_STATE_BODY_COPY}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

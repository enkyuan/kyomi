"use client";

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@kyomi/ui/components/empty";
import { getUserSafeErrorMessage } from "@kyomi/reader/lib/errors";

export function ErrorState({ error }: { error: unknown }) {
  return (
    <Empty className="h-full" size="md">
      <EmptyHeader>
        <EmptyTitle>Couldn't load article</EmptyTitle>
        <EmptyDescription>
          {getUserSafeErrorMessage(error, "There was a problem loading this item.")}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

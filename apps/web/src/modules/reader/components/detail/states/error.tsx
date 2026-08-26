"use client";

import { getUserSafeErrorMessage } from "@kyomi/reader/lib/errors";

export function ErrorState({ error }: { error: unknown }) {
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <p className="text-base font-semibold text-foreground">Couldn't load article</p>
      <p className="text-sm text-muted-foreground">
        {getUserSafeErrorMessage(error, "There was a problem loading this item.")}
      </p>
    </div>
  );
}

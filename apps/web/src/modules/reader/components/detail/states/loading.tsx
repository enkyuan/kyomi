"use client";

import { Skeleton } from "@kyomi/ui/atoms/skeleton";

export function LoadingState() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 p-12">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-6 w-3/4 rounded" />
        <Skeleton className="h-6 w-1/2 rounded" />
        <Skeleton className="h-4 w-32 rounded" />
      </div>
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-[94%] rounded" />
        <Skeleton className="h-4 w-[88%] rounded" />
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-[91%] rounded" />
        <Skeleton className="h-4 w-[85%] rounded" />
      </div>
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-[96%] rounded" />
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-[90%] rounded" />
      </div>
    </div>
  );
}

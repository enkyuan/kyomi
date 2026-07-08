"use client";

import type { ReactNode } from "react";
import { Transition, type TransitionOffset, type TransitionProps } from "@kyomi/ui/transition";

export const FEED_TRANSITION_OFFSET: TransitionOffset = {
  forward: { enter: 18, exit: -12 },
  backward: { enter: -12, exit: 18 },
};

export function Feed({
  detail,
  list,
  showDetail,
  transition,
}: {
  detail: ReactNode;
  list: ReactNode;
  showDetail: boolean;
  transition: Omit<TransitionProps, "children">;
}) {
  return (
    <div className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      <div
        aria-hidden={showDetail}
        className={`absolute inset-0 flex min-h-0 min-w-0 flex-col transition-opacity duration-150 ${
          showDetail ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        inert={showDetail ? true : undefined}
      >
        {list}
      </div>
      {showDetail ? <Transition {...transition}>{detail}</Transition> : null}
    </div>
  );
}

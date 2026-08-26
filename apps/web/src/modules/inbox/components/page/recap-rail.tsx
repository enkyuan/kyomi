"use client";

import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "@kyomi/ui/motion";
import { InboxRecapCard } from "@modules/inbox/components/recap";
import type { useInboxRouteState } from "@modules/inbox/hooks/use-layout";
import type {
  InboxRecapRailFolderBackTarget,
  InboxRecapRailSection,
} from "@modules/inbox/lib/recap/index";

/**
 * The desktop-only recap rail beside the inbox feed. `show` is driven by measured content width
 * (see `useRecapRailVisibility`), not a raw `xl:` viewport media query, so it agrees with the
 * split/stacked decision made by `useResponsiveReaderMode` and hides itself when the actual
 * content column is cramped even on a wide monitor.
 *
 * It actually mounts/unmounts (via `AnimatePresence`) instead of only toggling a `hidden` class,
 * so crossing that threshold during an ordinary resize animates instead of snapping.
 * `AnimatePresence initial={false}` still skips the entrance animation on the page's first
 * render, so it only animates on a later resize, never on load.
 */
export function RecapRail({
  show,
  navigate,
  rail,
  railFolderBack,
  railFolderId,
}: {
  show: boolean;
  navigate: ReturnType<typeof useInboxRouteState>["navigate"];
  rail?: InboxRecapRailSection;
  railFolderBack?: InboxRecapRailFolderBackTarget;
  railFolderId?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.28, bounce: 0 };

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence initial={false}>
        {show ? (
          <m.div
            key="recap-rail-wrapper"
            className="relative flex h-full shrink-0 flex-col"
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.98 }}
            transition={transition}
          >
            <aside className="flex h-full w-80 shrink-0 flex-col py-4.5 2xl:w-96 3xl:w-104">
              {/* Article detail replaces the inbox pane; keep this rail reserved for future context. */}
              <InboxRecapCard
                navigate={navigate}
                rail={rail}
                railFolderBack={railFolderBack}
                railFolderId={railFolderId}
              />
            </aside>
          </m.div>
        ) : null}
      </AnimatePresence>
    </LazyMotion>
  );
}

import type { InboxRecapRailSection } from "@modules/inbox/lib/recap/index";
import {
  TRANSITION_EASE_OUT,
  type TransitionDirection,
  type TransitionOffset,
  type TransitionProps,
} from "@kyomi/ui/transition";

export const RECAP_TRANSITION_OFFSET: TransitionOffset = {
  forward: { enter: 28, exit: -16 },
  backward: { enter: -16, exit: 28 },
};

export const RECAP_NAVIGATION_TRANSITION = {
  forward: { type: "tween" as const, duration: 0.22, ease: TRANSITION_EASE_OUT },
  backward: { type: "tween" as const, duration: 0.18, ease: TRANSITION_EASE_OUT },
} satisfies Record<TransitionDirection, NonNullable<TransitionProps["transition"]>>;

export function getRecapScreenKey({
  expandedSection,
}: {
  expandedSection: InboxRecapRailSection | null;
}) {
  return expandedSection ? `recap-expanded-${expandedSection}` : "recap-summary";
}

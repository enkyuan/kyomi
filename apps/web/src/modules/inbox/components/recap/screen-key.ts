import type { InboxRecapRailSection } from "@modules/inbox/lib/recap/index";

export function getRecapScreenKey({
  expandedSection,
  isError,
  isLoading,
}: {
  expandedSection: InboxRecapRailSection | null;
  isError: boolean;
  isLoading: boolean;
}) {
  if (isLoading) {
    return "recap-loading";
  }
  if (isError) {
    return "recap-error";
  }
  return expandedSection ? `recap-expanded-${expandedSection}` : "recap-summary";
}

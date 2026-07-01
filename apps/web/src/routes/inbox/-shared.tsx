import { useLoaderData } from "@tanstack/react-router";
import { Page } from "@modules/inbox";
import type { InboxLoaderData } from "./-route-helpers";

export function InboxRouteComponent() {
  const { initialInboxPreferences, initialSplitPanePercent } = useLoaderData({
    strict: false,
  }) as InboxLoaderData;

  return (
    <Page
      initialInboxPreferences={initialInboxPreferences}
      initialSplitPanePercent={initialSplitPanePercent}
    />
  );
}

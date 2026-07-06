import { useLoaderData } from "@tanstack/react-router";
import { Page } from "@modules/inbox";
import type { InboxLoaderData } from "./-route-helpers";

export function InboxRouteComponent() {
  const { initialInboxPreferences } = useLoaderData({
    strict: false,
  }) as InboxLoaderData;

  return <Page initialInboxPreferences={initialInboxPreferences} />;
}

import { useLoaderData } from "@tanstack/react-router";
import { Page } from "@modules/inbox/page";
import type { InboxLoaderData } from "./-loader";

export function InboxRouteComponent() {
  const { initialInboxPreferences, initialTimezoneOffsetMinutes } = useLoaderData({
    strict: false,
  }) as InboxLoaderData;

  return (
    <Page
      initialInboxPreferences={initialInboxPreferences}
      initialTimezoneOffsetMinutes={initialTimezoneOffsetMinutes}
    />
  );
}

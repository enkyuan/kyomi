import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAuth } from "@/routes/-guards";
import { InboxPage } from "@modules/inbox/page";
import { getInboxPreferences } from "@lib/inbox-preferences-functions";

const inboxSearchSchema = z.object({
  filter: z.enum(["inbox", "today", "unread", "saved", "recent"]).optional(),
  search: z.string().optional(),
  feedId: z.string().optional(),
  folderId: z.string().optional(),
  itemId: z.string().optional(),
  showHidden: z.literal("1").optional(),
  showRead: z.literal("1").optional(),
});

export const Route = createFileRoute("/inbox/")({
  loader: async () => {
    await requireAuth();
    const initialInboxPreferences = await getInboxPreferences();
    return { initialInboxPreferences };
  },
  validateSearch: (search) => inboxSearchSchema.parse(search),
  component: InboxRouteComponent,
});

function InboxRouteComponent() {
  const { initialInboxPreferences } = Route.useLoaderData();
  return <InboxPage initialInboxPreferences={initialInboxPreferences} />;
}

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAuth } from "@/routes/-guards";
import { Page } from "@modules/inbox";
import { getInboxLoaderData } from "@modules/inbox/services/route-loader";

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
  validateSearch: (search) => inboxSearchSchema.parse(search),
  loader: async () => {
    const [, loaderData] = await Promise.all([requireAuth(), getInboxLoaderData()]);
    return loaderData;
  },
  component: InboxRouteComponent,
});

function InboxRouteComponent() {
  const { initialInboxPreferences, initialSplitPanePercent } = Route.useLoaderData();
  return (
    <Page
      initialInboxPreferences={initialInboxPreferences}
      initialSplitPanePercent={initialSplitPanePercent}
    />
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireAuth } from "@/routes/-guards";
import { InboxPage } from "@modules/inbox/page";
import { getInboxPreferences } from "@lib/inbox-preferences-functions";
import {
  readInboxArticleOpenBehaviorCookie,
  readInboxSplitPanePercentCookie,
} from "@modules/inbox/lib/layout-persistence";

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
    await requireAuth();
    const headers = getRequestHeaders();
    const initialInboxPreferences = await getInboxPreferences();
    const cookieArticleOpenBehavior = readInboxArticleOpenBehaviorCookie(headers.get("cookie"));
    const initialSplitPanePercent = readInboxSplitPanePercentCookie(headers.get("cookie"));

    return {
      initialInboxPreferences: cookieArticleOpenBehavior
        ? {
            ...initialInboxPreferences,
            articleOpenBehavior: cookieArticleOpenBehavior,
          }
        : initialInboxPreferences,
      initialSplitPanePercent,
    };
  },
  component: InboxRouteComponent,
});

function InboxRouteComponent() {
  const { initialInboxPreferences, initialSplitPanePercent } = Route.useLoaderData();
  return (
    <InboxPage
      initialInboxPreferences={initialInboxPreferences}
      initialSplitPanePercent={initialSplitPanePercent}
    />
  );
}

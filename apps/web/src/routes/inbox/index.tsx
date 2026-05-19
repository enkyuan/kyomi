import { createFileRoute } from "@tanstack/react-router";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireAuth } from "@/routes/-guards";
import {
  getInboxPreferences,
  Page,
  readInboxArticleOpenBehaviorCookie,
  readInboxSplitPanePercentCookie,
} from "@modules/inbox";

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
    const headers = getRequestHeaders();
    const [, initialInboxPreferences] = await Promise.all([requireAuth(), getInboxPreferences()]);
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
    <Page
      initialInboxPreferences={initialInboxPreferences}
      initialSplitPanePercent={initialSplitPanePercent}
    />
  );
}

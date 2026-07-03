import type { InboxRecapDto } from "@modules/inbox/lib/recap/schema";

export type RecapTopViewedFeed = InboxRecapDto["topViewedFeeds"][number];
export type RecapSavedItem = InboxRecapDto["oldestSavedItems"][number];

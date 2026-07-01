import type { InboxRecapDto } from "@modules/inbox/services/recap-schema";

export type RecapFolder = InboxRecapDto["folders"][number];
export type RecapTopViewedFeed = InboxRecapDto["topViewedFeeds"][number];
export type RecapSavedItem = InboxRecapDto["oldestSavedItems"][number];

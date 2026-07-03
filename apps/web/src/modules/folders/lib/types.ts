import type { InboxRecapDto } from "@modules/inbox/lib/recap/schema";

export type RecapFolder = InboxRecapDto["folders"][number];
export type FolderSummary = RecapFolder;

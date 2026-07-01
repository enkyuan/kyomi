import type { InboxOrganizerDto } from "../../services/organizer-schema";

export type OrganizerFolder = InboxOrganizerDto["folders"][number];
export type OrganizerTopViewedFeed = InboxOrganizerDto["topViewedFeeds"][number];
export type OrganizerSavedItem = InboxOrganizerDto["oldestSavedItems"][number];

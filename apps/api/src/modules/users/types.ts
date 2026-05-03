/** Public user profile for `GET /api/v1/users/profile` (no secrets). */
export type UserProfileDto = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReaderDefaultModeDto = "smart" | "original" | "extracted";
export type ReaderContentWidthDto = "narrow" | "wide";
export type InboxDefaultViewDto = "inbox" | "today" | "unread" | "saved";
export type InboxDensityDto = "comfortable" | "compact";
export type ArticleOpenBehaviorDto = "split" | "reader";
export type InboxMarkReadBehaviorDto = "on-open" | "after-delay" | "manual";
export type InboxTimestampDisplayDto = "absolute" | "relative";
export type InboxTimestampHourCycleDto = "12h" | "24h";

export type UserPreferencesDto = {
  defaultMode: ReaderDefaultModeDto;
  fontSizePx: number;
  contentWidth: ReaderContentWidthDto;
  openLinksInNewTab: boolean;
  showLinkPreviews: boolean;
  showImages: boolean;
  inboxDefaultView: InboxDefaultViewDto;
  inboxDensity: InboxDensityDto;
  articleOpenBehavior: ArticleOpenBehaviorDto;
  inboxMarkReadBehavior: InboxMarkReadBehaviorDto;
  inboxTimestampDisplay: InboxTimestampDisplayDto;
  inboxTimestampHourCycle: InboxTimestampHourCycleDto;
  inboxFontSizePx: number;
  inboxShowRecents: boolean;
  inboxShowFavicons: boolean;
};

export type UpdateUserPreferencesDto = Partial<UserPreferencesDto>;

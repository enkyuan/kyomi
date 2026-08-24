import { z } from "zod";

const readerDefaultModeSchema = z.enum(["smart", "original", "extracted"]);
const readerContentWidthSchema = z.enum(["narrow", "wide"]);
const inboxDefaultViewSchema = z
  .union([
    z.literal("my-feed"),
    z.literal("all"),
    z.literal("saved"),
    z.literal("recent"),
    z.literal("inbox"),
    z.literal("today"),
    z.literal("unread"),
  ])
  .transform((value): "my-feed" | "all" | "saved" | "recent" =>
    value === "inbox" || value === "today" || value === "unread" ? "my-feed" : value,
  );
const inboxDensitySchema = z.enum(["comfortable", "compact"]);
const articleOpenBehaviorSchema = z.enum(["split", "reader"]);
const inboxMarkReadBehaviorSchema = z.enum(["on-open", "after-delay", "manual"]);
const inboxTimestampDisplaySchema = z.enum(["absolute", "relative"]);
const inboxTimestampHourCycleSchema = z.enum(["12h", "24h"]);

export const readerPreferencesSchema = z.object({
  defaultMode: readerDefaultModeSchema,
  fontSizePx: z.number(),
  contentWidth: readerContentWidthSchema,
  openLinksInNewTab: z.boolean(),
  showLinkPreviews: z.boolean(),
  showImages: z.boolean(),
});

export const inboxPreferencesSchema = z.object({
  inboxDefaultView: inboxDefaultViewSchema,
  inboxDensity: inboxDensitySchema,
  articleOpenBehavior: articleOpenBehaviorSchema,
  inboxMarkReadBehavior: inboxMarkReadBehaviorSchema,
  inboxTimestampDisplay: inboxTimestampDisplaySchema,
  inboxTimestampHourCycle: inboxTimestampHourCycleSchema,
  inboxFontSizePx: z.number(),
  inboxShowFavicons: z.boolean(),
});

export const userPreferencesSchema = readerPreferencesSchema.extend({
  inboxDefaultView: inboxDefaultViewSchema,
  inboxDensity: inboxDensitySchema,
  articleOpenBehavior: articleOpenBehaviorSchema,
  inboxMarkReadBehavior: inboxMarkReadBehaviorSchema,
  inboxTimestampDisplay: inboxTimestampDisplaySchema,
  inboxTimestampHourCycle: inboxTimestampHourCycleSchema,
  inboxFontSizePx: z.number(),
  inboxShowFavicons: z.boolean(),
});

export type ReaderDefaultModeDto = z.infer<typeof readerDefaultModeSchema>;
export type ReaderContentWidthDto = z.infer<typeof readerContentWidthSchema>;
export type ReaderPreferencesDto = z.infer<typeof readerPreferencesSchema>;
export type InboxDefaultViewDto = z.infer<typeof inboxDefaultViewSchema>;
export type InboxDensityDto = z.infer<typeof inboxDensitySchema>;
export type ArticleOpenBehaviorDto = z.infer<typeof articleOpenBehaviorSchema>;
export type InboxMarkReadBehaviorDto = z.infer<typeof inboxMarkReadBehaviorSchema>;
export type InboxTimestampDisplayDto = z.infer<typeof inboxTimestampDisplaySchema>;
export type InboxTimestampHourCycleDto = z.infer<typeof inboxTimestampHourCycleSchema>;
export type InboxPreferencesDto = z.infer<typeof inboxPreferencesSchema>;
export type UserPreferencesDto = z.infer<typeof userPreferencesSchema>;

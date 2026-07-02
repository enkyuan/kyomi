import { describe, expect, test } from "vitest";
import { userPreferencesSchema } from "@lib/schemas";

const basePreferences = {
  defaultMode: "smart",
  fontSizePx: 17,
  contentWidth: "wide",
  openLinksInNewTab: true,
  showLinkPreviews: true,
  showImages: true,
  inboxDensity: "comfortable",
  articleOpenBehavior: "split",
  inboxMarkReadBehavior: "on-open",
  inboxTimestampDisplay: "relative",
  inboxTimestampHourCycle: "12h",
  inboxFontSizePx: 16,
  inboxShowFavicons: true,
} as const;

describe("userPreferencesSchema", () => {
  test("normalizes removed inbox default views from preference responses", () => {
    for (const inboxDefaultView of ["inbox", "today", "unread"] as const) {
      expect(userPreferencesSchema.parse({ ...basePreferences, inboxDefaultView })).toMatchObject({
        inboxDefaultView: "my-feed",
      });
    }
  });
});

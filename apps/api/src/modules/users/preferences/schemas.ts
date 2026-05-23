import { t } from "elysia";

export const userPreferencesResponse = t.Object({
  defaultMode: t.Union([t.Literal("smart"), t.Literal("original"), t.Literal("extracted")]),
  fontSizePx: t.Number(),
  contentWidth: t.Union([t.Literal("narrow"), t.Literal("wide")]),
  openLinksInNewTab: t.Boolean(),
  showLinkPreviews: t.Boolean(),
  showImages: t.Boolean(),
  inboxDefaultView: t.Union([
    t.Literal("inbox"),
    t.Literal("today"),
    t.Literal("unread"),
    t.Literal("saved"),
  ]),
  inboxDensity: t.Union([t.Literal("comfortable"), t.Literal("compact")]),
  articleOpenBehavior: t.Union([t.Literal("split"), t.Literal("reader")]),
  inboxMarkReadBehavior: t.Union([
    t.Literal("on-open"),
    t.Literal("after-delay"),
    t.Literal("manual"),
  ]),
  inboxTimestampDisplay: t.Union([t.Literal("absolute"), t.Literal("relative")]),
  inboxTimestampHourCycle: t.Union([t.Literal("12h"), t.Literal("24h")]),
  inboxFontSizePx: t.Number({ minimum: 14, maximum: 20 }),
  inboxShowRecents: t.Boolean(),
  inboxShowFavicons: t.Boolean(),
});

export const updateUserPreferencesBody = t.Object({
  defaultMode: t.Optional(
    t.Union([t.Literal("smart"), t.Literal("original"), t.Literal("extracted")]),
  ),
  fontSizePx: t.Optional(t.Number({ minimum: 14, maximum: 22 })),
  contentWidth: t.Optional(t.Union([t.Literal("narrow"), t.Literal("wide")])),
  openLinksInNewTab: t.Optional(t.Boolean()),
  showLinkPreviews: t.Optional(t.Boolean()),
  showImages: t.Optional(t.Boolean()),
  inboxDefaultView: t.Optional(
    t.Union([t.Literal("inbox"), t.Literal("today"), t.Literal("unread"), t.Literal("saved")]),
  ),
  inboxDensity: t.Optional(t.Union([t.Literal("comfortable"), t.Literal("compact")])),
  articleOpenBehavior: t.Optional(t.Union([t.Literal("split"), t.Literal("reader")])),
  inboxMarkReadBehavior: t.Optional(
    t.Union([t.Literal("on-open"), t.Literal("after-delay"), t.Literal("manual")]),
  ),
  inboxTimestampDisplay: t.Optional(t.Union([t.Literal("absolute"), t.Literal("relative")])),
  inboxTimestampHourCycle: t.Optional(t.Union([t.Literal("12h"), t.Literal("24h")])),
  inboxFontSizePx: t.Optional(t.Number({ minimum: 14, maximum: 20 })),
  inboxShowRecents: t.Optional(t.Boolean()),
  inboxShowFavicons: t.Optional(t.Boolean()),
});

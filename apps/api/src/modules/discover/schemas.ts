import { t } from "elysia";

export const discoverSearchRateLimit = {
  name: "discover.search",
  max: 60,
  windowMs: 60_000,
} as const;

export const discoverPreviewRateLimit = {
  name: "discover.preview",
  max: 20,
  windowMs: 5 * 60_000,
} as const;

export const feedPreviewResponse = t.Object({
  id: t.Union([t.String(), t.Null()]),
  url: t.String(),
  title: t.String(),
  description: t.String(),
  link: t.Union([t.String(), t.Null()]),
  faviconUrl: t.Union([t.String(), t.Null()]),
  isSubscribed: t.Boolean(),
});

export const feedSearchItem = t.Object({
  id: t.String(),
  url: t.String(),
  title: t.String(),
  description: t.Union([t.String(), t.Null()]),
  link: t.Union([t.String(), t.Null()]),
  faviconUrl: t.Union([t.String(), t.Null()]),
  isSubscribed: t.Boolean(),
});

export const discoverSearchQuery = t.Object({
  q: t.String({ minLength: 1 }),
  limit: t.Optional(t.Numeric()),
});

export const discoverPreviewQuery = t.Object({
  url: t.String({ minLength: 1 }),
});

import { t } from "elysia";
import { uuidParam } from "@shared/http/v1/params";

export const continueReadingQuerySchema = t.Object({
  limit: t.Optional(t.String()),
});

export const continueReadingImpressionsBodySchema = t.Object({
  articleIds: t.Array(uuidParam, { minItems: 1, maxItems: 20 }),
});

/** Per-user ceilings; both calls are cheap but write rows. */
export const continueReadingImpressionsRateLimit = {
  name: "articles.continue-reading.impressions",
  max: 60,
  windowMs: 60_000,
} as const;

export const continueReadingDismissRateLimit = {
  name: "articles.continue-reading.dismiss",
  max: 60,
  windowMs: 60_000,
} as const;

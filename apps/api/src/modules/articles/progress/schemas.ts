import { t } from "elysia";

const CONTENT_KEY_MAX_CHARS = 128;
const ANCHOR_FINGERPRINT_MAX_CHARS = 32;
const ANCHOR_BLOCK_INDEX_MAX = 10_000;
/** A single article open never accrues a day of active reading; this also keeps int4 columns safe. */
export const SESSION_ACTIVE_MS_MAX = 86_400_000;

export const readingStateSchema = t.Union([
  t.Literal("reading"),
  t.Literal("resurfacing"),
  t.Literal("completed"),
  t.Literal("dismissed"),
  t.Literal("abandoned"),
]);

export const readingBlockAnchorSchema = t.Object({
  kind: t.Literal("block"),
  blockIndex: t.Integer({ minimum: 0, maximum: ANCHOR_BLOCK_INDEX_MAX }),
  offset: t.Number({ minimum: 0, maximum: 1 }),
  fingerprint: t.String({ maxLength: ANCHOR_FINGERPRINT_MAX_CHARS }),
});

export const readingProgressDtoSchema = t.Object({
  progress: t.Number(),
  maxProgress: t.Number(),
  state: readingStateSchema,
  engaged: t.Boolean(),
  remainingMinutes: t.Union([t.Number(), t.Null()]),
  lastReadAt: t.String(),
  completedAt: t.Union([t.String(), t.Null()]),
});

export const readingPositionDtoSchema = t.Object({
  progress: t.Number(),
  anchor: t.Union([readingBlockAnchorSchema, t.Null()]),
  contentKey: t.String(),
  updatedAt: t.String(),
});

export const readingProgressUpdateBodySchema = t.Object({
  progress: t.Number({ minimum: 0, maximum: 1 }),
  anchor: t.Union([readingBlockAnchorSchema, t.Null()]),
  contentKey: t.String({ minLength: 1, maxLength: CONTENT_KEY_MAX_CHARS }),
  sessionId: t.String({ format: "uuid" }),
  sessionActiveMs: t.Integer({ minimum: 0, maximum: SESSION_ACTIVE_MS_MAX }),
  completed: t.Boolean(),
  clientUpdatedAt: t.String({ format: "date-time" }),
});

export const readingProgressResponseSchema = t.Object({
  readingProgress: readingProgressDtoSchema,
});

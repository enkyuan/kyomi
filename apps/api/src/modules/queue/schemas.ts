import { t } from "elysia";

export const deadLetterItem = t.Object({
  id: t.String(),
  type: t.String(),
  attempts: t.Number(),
  error: t.Union([t.String(), t.Null()]),
  failedAt: t.Union([t.String(), t.Null()]),
  originalStreamId: t.Union([t.String(), t.Null()]),
  payload: t.String(),
});

export const replayBody = t.Object({
  ids: t.Array(t.String(), { minItems: 1 }),
});

export const deadLetterListQuery = t.Object({
  limit: t.Optional(t.Numeric()),
});

export const replayResponse = t.Object({
  message: t.String(),
  replayed: t.Number(),
});

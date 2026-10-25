# Reading Progress and Continue Reading

Status: in implementation, 2026-10-24. This file is the shared contract for the parallel
workstreams below. Names, paths, wire shapes, and signatures here are fixed; a workstream that needs
one changed asks the coordinator instead of diverging.

## Goal

Track how far a user has read each article, restore their position on any device, and resurface
unfinished articles on a schedule that borrows spaced-repetition backoff: an article that keeps
being ignored is shown less and less, then retired.

Phase 0 and 1 run on the current HTML reader path. The Kyomi Document Model (KDM) work, including
storage, compiler pass 17 (`wordCount`), and the web and mobile KDM renderers, is owned by other
sessions. This feature reserves a block anchor in the wire shape for KDM and does not implement KDM
behavior.

## Workstreams and file ownership

Each workstream edits only the files it owns. Reading anything is fine. When a dependency file
does not exist yet, code against the signature in this document and re-check before finishing.

| Workstream       | Owns                                                                                                                                                                                                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `progress-api`   | `packages/db/src/schema/articles.ts` (the new table only), `packages/db/src/schema/preferences.ts` (the new column only), the generated migration, `apps/api/src/modules/articles/progress/**`, `apps/api/src/modules/articles/routes.ts`, `apps/api/src/modules/articles/schemas.ts`, the list and detail queries under `apps/api/src/modules/articles/read/**`, the user preferences API, `tests/api/integration/modules/articles/progress/**` |
| `resurface-api`  | `apps/api/src/modules/articles/resurface/**`, `tests/api/integration/modules/articles/resurface/**`                                                                                                                                                                                                                                                       |
| `reader-core`    | `packages/reader/src/core/progress.ts`, its export from `packages/reader/src/core/index.ts`, `packages/reader/src/schemas/article.ts`, `packages/reader/src/schemas/preferences.ts`, `tests/web/integration/src/packages/reader/progress*.test.ts`                                                                                                           |
| `web`            | `apps/web/src/**` changes for tracking, restore, badge, recap section, settings toggle, and query keys; `tests/web/integration/**` for those                                                                                                                                                                                                                 |
| `mobile`         | `apps/mobile/src/**` and `apps/mobile/modules/article-list/ios/**` changes for badge, label, tracking, restore, and offline buffer; mobile tests                                                                                                                                                                                                             |

Nobody commits. The coordinator reviews and creates the GitButler checkpoints.

## Data model

New table `article_reading_state` in `packages/db/src/schema/articles.ts`, exported as
`articleReadingState`. It follows the `article_view_events` convention of one nullable foreign key
per article kind.

| Column                   | Type        | Notes                                                                                   |
| ------------------------ | ----------- | --------------------------------------------------------------------------------------- |
| `id`                     | `text` PK   | `crypto.randomUUID()`                                                                   |
| `user_id`                | `text`      | FK `users.id`, cascade                                                                  |
| `feed_item_id`           | `text` null | FK `feed_items.id`, cascade                                                             |
| `clip_id`                | `text` null | FK `article_clips.id`, cascade                                                          |
| `progress`               | `real`      | 0–1, current position, default 0                                                        |
| `max_progress`           | `real`      | 0–1, high-water mark, default 0                                                         |
| `anchor`                 | `jsonb` null| `ReadingBlockAnchor`, reserved for KDM, null on the HTML path                           |
| `content_key`            | `text`      | see "Content key"                                                                       |
| `content_words`          | `integer` null | word count of the content read, computed once on first write                         |
| `active_read_ms`         | `integer`   | default 0                                                                               |
| `session_count`          | `integer`   | default 0                                                                               |
| `last_session_id`        | `text` null |                                                                                         |
| `last_session_active_ms` | `integer`   | default 0                                                                               |
| `client_updated_at`      | `timestamp` null | last accepted position write, clamped to server time                               |
| `first_read_at`          | `timestamp` |                                                                                         |
| `last_read_at`           | `timestamp` |                                                                                         |
| `completed_at`           | `timestamp` null |                                                                                    |
| `state`                  | `text`      | `reading` \| `resurfacing` \| `completed` \| `dismissed` \| `abandoned`, default `reading` |
| `due_at`                 | `timestamp` null |                                                                                    |
| `interval_days`          | `real`      | default 1                                                                               |
| `ease`                   | `real`      | default 2                                                                               |
| `impressions`            | `integer`   | default 0                                                                               |
| `lapses`                 | `integer`   | default 0                                                                               |
| `last_impression_at`     | `timestamp` null |                                                                                    |
| `dismissed_at`           | `timestamp` null |                                                                                    |
| `updated_at`             | `timestamp` | default now                                                                             |

Constraints and indexes:

- `CHECK (num_nonnulls(feed_item_id, clip_id) = 1)`.
- Unique `(user_id, feed_item_id) WHERE feed_item_id IS NOT NULL` and
  `(user_id, clip_id) WHERE clip_id IS NOT NULL`.
- `(user_id, due_at) WHERE state IN ('reading', 'resurfacing')` for the scheduler read.

The table is separate from `feed_item_user_state` so frequent position writes do not churn that
table's partial indexes, which every list query joins.

New preference column `reader_remember_position boolean NOT NULL DEFAULT true` on
`user_preferences` (`readerRememberPosition` in Drizzle). The preferences DTO key follows the
existing reader keys, which drop the prefix (`showImages`, `fontSizePx`): it is `rememberPosition`
in `readerPreferencesSchema`, and so in `userPreferencesSchema`, on both GET and PATCH. When false,
clients neither send progress nor restore, and the API write is a no-op that returns the current
state.

The migration is `packages/db/drizzle/0042_article_reading_state.sql`.

## Wire contract

TypeScript names below are the zod types in `packages/reader/src/schemas/article.ts` (clients) and
mirrored as Elysia `t` schemas in `apps/api/src/modules/articles/progress/schemas.ts` (server).

```ts
type ReadingState = "reading" | "resurfacing" | "completed" | "dismissed" | "abandoned";

/** KDM only. Not sent on the HTML path. */
type ReadingBlockAnchor = {
  kind: "block";
  blockIndex: number; // integer, 0..10_000
  offset: number; // 0..1 within the block
  fingerprint: string; // <= 32 chars
};

/** On every article list item and on article detail. Null when no row exists. */
type ReadingProgressDto = {
  progress: number;
  maxProgress: number;
  state: ReadingState;
  /** Engaged: maxProgress >= 0.05 and activeReadMs >= 20_000. Only engaged rows resurface. */
  engaged: boolean;
  remainingMinutes: number | null;
  lastReadAt: string; // UTC ISO
  completedAt: string | null;
};

/** Detail only, for restore. */
type ReadingPositionDto = {
  progress: number;
  anchor: ReadingBlockAnchor | null;
  contentKey: string;
  updatedAt: string;
};

type ReadingProgressUpdateBody = {
  progress: number; // 0..1
  anchor: ReadingBlockAnchor | null;
  contentKey: string; // <= 128 chars
  sessionId: string; // uuid, one per article open
  sessionActiveMs: number; // integer >= 0, cumulative for this session
  completed: boolean; // client saw the end of the content
  clientUpdatedAt: string; // UTC ISO
};
```

DTO additions:

- `articleListItemSchema` gains `readingProgress: ReadingProgressDto | null`.
- `articleDetailSchema` gains `readingProgress` (inherited on the client) and
  `readingPosition: ReadingPositionDto | null`.
- `lastViewedAt` keeps its meaning: the article was opened.

### Endpoints

All under `/api/v1`, authenticated, with the existing rate-limit plugin.

| Method and path                                        | Owner           | Body                         | 200 response                       |
| ------------------------------------------------------ | --------------- | ---------------------------- | ---------------------------------- |
| `PUT /articles/:articleId/progress`                    | `progress-api`  | `ReadingProgressUpdateBody`  | `{ readingProgress: ReadingProgressDto }` |
| `GET /articles/views/continue-reading?limit=5`         | `resurface-api` | none; `limit` 1..20          | `cursorListResponseSchema` with `next_cursor: null`, `has_more: false` |
| `POST /articles/views/continue-reading/impressions`    | `resurface-api` | `{ articleIds: string[] }` (1..20 uuids) | `{ message }`             |
| `POST /articles/:articleId/continue-reading/dismiss`   | `resurface-api` | none                         | `{ message }`                      |

`progress-api` registers both route modules from `apps/api/src/modules/articles/routes.ts`:
`registerArticleProgressRoutes` from `./progress/routes` and `registerArticleResurfaceRoutes` from
`./resurface/routes`.

### Write semantics (`progress-api`)

- Authorization matches `POST /articles/:articleId/view`: clips must belong to the user; feed items
  must exist.
- Position (`progress`, `anchor`, `content_key`) is last-write-wins on `clientUpdatedAt`, clamped to
  server `now`. Writes older than the stored `client_updated_at` leave position unchanged.
- `max_progress = GREATEST(max_progress, progress)`.
- A first write has no previous write to measure wall time from, so its active time is capped at
  60 s plus the 5 s slack.
- List responses attach `readingProgress` with one indexed lookup per returned page
  (`attachReadingProgress` in `progress/read.ts`), not a join. The inbox list sorts every
  candidate row before its limit, so a join probed the reading table once per candidate. Detail
  responses join.
- Active time is idempotent per session. A new `sessionId` increments `session_count` and adds
  `sessionActiveMs`. The same `sessionId` adds `max(0, sessionActiveMs - last_session_active_ms)`.
  Every delta is clamped to the wall time since the previous accepted write plus 5 s.
- `content_words` is computed on the first write from the article's selected text content and kept.
- `remainingMinutes = ceil(content_words * (1 - progress) / 238)`, null when `content_words` is null.
- Completion: `completed === true` or `progress >= 0.9` sets `completed_at` once.
- After updating, the write calls `applyProgressWrite` from `resurface/schedule.ts` and persists the
  returned schedule fields in the same statement or transaction.

### Content key

`buildContentKey` in `packages/reader/src/core/progress.ts` produces the key from the reader
content the client rendered, as `<source>:<sanitizerVersion | "none">`. A restore applies the stored
position only when the key matches; otherwise the client starts at the top.

## Scheduler (`resurface-api`)

`apps/api/src/modules/articles/resurface/schedule.ts` holds pure functions only, with `now` passed
in. `progress-api` imports `applyProgressWrite` and `isEngaged`.

```ts
export const RESURFACE_CONFIG = {
  engagedMinProgress: 0.05,
  engagedMinActiveMs: 20_000,
  completeThreshold: 0.9,
  minWords: 400,
  minGapMs: 6 * 3_600_000,
  initialIntervalDays: 1,
  initialEase: 2,
  minEase: 1.3,
  maxEase: 3,
  easeBonus: 0.1,
  lapsePenalty: 0.2,
  maxLapses: 4,
  maxIntervalDays: 30,
  impressionCooldownMs: 20 * 3_600_000,
} as const;

export type ScheduleFields = {
  state: ReadingState;
  dueAt: Date | null;
  intervalDays: number;
  ease: number;
  impressions: number;
  lapses: number;
  lastImpressionAt: Date | null;
  dismissedAt: Date | null;
};

export function isEngaged(input: { maxProgress: number; activeReadMs: number }): boolean;

export function applyProgressWrite(
  prev: ScheduleFields | null,
  input: { isNewSession: boolean; completed: boolean; lastReadAt: Date; now: Date },
): ScheduleFields;

export function applyImpression(prev: ScheduleFields, now: Date): ScheduleFields;

export function applyDismiss(prev: ScheduleFields, now: Date): ScheduleFields;

export function isEligible(
  row: ScheduleFields & {
    maxProgress: number;
    activeReadMs: number;
    contentWords: number | null;
    lastReadAt: Date;
    isHidden: boolean;
  },
  now: Date,
): boolean;
```

Rules:

- A completed write moves to `completed`. Dismiss moves to `dismissed`. Both are terminal.
- A write, new session or not, sets `dueAt = lastReadAt + intervalDays`. A new session on a
  `reading` or `resurfacing` row is a resume: `state` returns to `reading`, `intervalDays` resets
  to `initialIntervalDays`, `lapses` resets to 0 (so `maxLapses` counts consecutive ignored
  impressions), and `ease = min(maxEase, ease + easeBonus)`. A resume within
  `impressionCooldownMs` of the last impression came from that impression, so it also refunds
  `lapsePenalty`.
- An `abandoned` row is not revived by reading; a completed write still moves it to `completed`.
- An impression outside `impressionCooldownMs` is a lapse: `impressions++`, `lapses++`,
  `intervalDays = min(maxIntervalDays, intervalDays * ease)`,
  `ease = max(minEase, ease - lapsePenalty)`, `dueAt = now + intervalDays`, `state = resurfacing`.
  Reaching `maxLapses`, or an interval at `maxIntervalDays`, moves to `abandoned`.
- Eligible: state `reading` or `resurfacing`, engaged, `contentWords >= minWords`, `dueAt <= now`,
  `now - lastReadAt >= minGapMs`, not hidden.

`apps/api/src/modules/articles/resurface/score.ts` ranks eligible rows:

```text
priority  = freshness × (0.35·momentum + 0.25·completability + 0.20·interest + 0.10·affinity + 0.10·saved)
momentum       = maxProgress
completability = 1 / (1 + remainingMinutes / 8)
interest       = min(1, activeReadMs / expectedMs), expectedMs = contentWords · maxProgress / 238 min
affinity       = log1p(feed viewed_item_count) / log1p(user's max viewed_item_count); 0 for clips
saved          = 1 when saved
freshness      = 0.5 ^ (daysSinceLastRead / halfLife), halfLife 7 d under 2_000 words, else 21 d
```

The read view loads the user's candidate rows through the partial index, scores them in TypeScript,
and returns the top `limit` as full list items with `readingProgress` set. No background job.

## Clients

### Shared core (`reader-core`)

`packages/reader/src/core/progress.ts`, runtime-neutral, no DOM or React Native imports:

```ts
export const READING_FLUSH_INTERVAL_MS = 10_000;
export const READING_IDLE_TIMEOUT_MS = 30_000;
export const READING_COMPLETE_THRESHOLD = 0.9;
/** The reading line sits this far down the viewport. */
export const READING_LINE_RATIO = 0.25;

export type ScrollMetrics = {
  scrollTop: number;
  viewportHeight: number;
  contentTop: number; // offset of the article body within the scroll content
  contentHeight: number;
};

export function progressFromScroll(metrics: ScrollMetrics): number; // clamped 0..1
export function scrollTopForProgress(progress: number, metrics: Omit<ScrollMetrics, "scrollTop">): number;
export function buildContentKey(reader: ReaderContent): string;

export type ActiveTimer = {
  markActivity(): void;
  setVisible(visible: boolean): void;
  elapsedMs(): number;
};
export function createActiveTimer(now?: () => number): ActiveTimer;

export type ReadingSession = {
  readonly sessionId: string;
  sample(input: { progress: number; completed?: boolean }): void;
  /** The body to send, or null when nothing changed since the last flush. */
  takeUpdate(): ReadingProgressUpdateBody | null;
};
export function createReadingSession(input: {
  contentKey: string;
  timer: ActiveTimer;
  now?: () => number;
  createId?: () => string;
}): ReadingSession;

export function isContinuingReading(progress: ReadingProgressDto | null | undefined): boolean;
export function formatRemainingMinutes(minutes: number | null): string | null; // "6 min left", "Under 1 min left"
```

`isContinuingReading` is `engaged && (state === "reading" || state === "resurfacing")`. Both clients
use it for their Continue reading badge.

### Web (`web`)

- Tracking and restore in `apps/web/src/modules/reader/hooks/use-reading-progress.ts`, driven by the
  detail `ScrollArea` viewport in `reader/components/detail/index.tsx`. Restore replaces the
  unconditional scroll to top when `readingPosition` exists, its `contentKey` matches, and the
  preference is on. Re-apply once after images settle if the user has not scrolled.
- Flush every `READING_FLUSH_INTERVAL_MS` while active, on article change, and on
  `visibilitychange` to hidden.
- Mutations as server functions in `apps/web/src/modules/articles/lib/api.ts`.
- Badge on the inbox item card: "Continue reading", plus `formatRemainingMinutes` when present.
- New recap section `apps/web/src/modules/inbox/components/recap/sections/continue-reading.tsx`
  above "Worth revisiting", fed by the continue-reading view. It reports impressions for rows at least
  50% visible for 1 s, batched, at most once per row per page view, and offers a dismiss action.
  "Worth revisiting" is unchanged.
- A "Remember reading position" toggle in settings.

### Mobile (`mobile`)

- `apps/mobile/src/modules/articles/lib/list-rows.ts` and the React Native item card use
  `isContinuingReading` in place of `Boolean(item.lastViewedAt)`.
- A per-row `continueLabel` on `ArticleRowWire` and `ArticleRowModel` (optional, falls back to the
  style's label) carries `formatRemainingMinutes`.
- Tracking and restore live in the reader screen and a hook, not in the renderer. The current
  WebView body (`article-body.dom.tsx`) gains only `initialProgress` and `onReadingProgress` props,
  reporting at most every 2 s. The KDM renderer session will implement the same two props.
- Flush every `READING_FLUSH_INTERVAL_MS`, on `AppState` background, and on unmount. Writes that
  fail are buffered in app storage and retried on the next foreground.
- No mobile Continue reading surface and no impressions in this phase.

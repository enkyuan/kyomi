# Server State Audit

Current browser-persisted state:

- `theme` in `localStorage`: should become server-backed when account preferences are introduced. Safe as a local default until then.
- `cronos:hot-query-cache:v1` in `localStorage`: React Query warm cache only. Server responses remain source of truth.
- `cronos:pinned-feed-ids` and migration keys in `localStorage`: migration-only legacy state. Remove after one or two releases once migration metrics show no active migrations.
- `sidebar_state` cookie: local-only UI chrome state. Does not need server persistence.

Already server-backed:

- Feed pinning: `feed_subscriptions.is_pinned` / `pinned_at`.
- Folder membership: `feed_subscriptions.folder_id`.
- Feed article saved/read state: `feed_item_user_state`.
- Clip saved/read state: `article_clips`.

Next server-backed preferences table should cover only durable cross-device preferences, such as `theme`, `reader_mode`, `inbox_density`, and `article_open_behavior`. Keep feed-specific state on `feed_subscriptions` and article-specific state on `feed_item_user_state`.


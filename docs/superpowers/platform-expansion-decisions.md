# Platform Expansion Decisions

> Source of truth for the platform-expansion feature flags, external credentials, and
> cross-cutting product decisions introduced by the platform-expansion roadmap
> (`docs/superpowers/plans/2026-07-01-platform-expansion-roadmap.md`, Task 1).
>
> This document records _decisions_, not implementation. When a decision changes, update
> this file in the same change that alters behavior.

## Feature flag defaults

Every optional platform-expansion capability is gated behind a `FEATURE_*` flag. All flags
default to `false` in local development and examples. Existing stable behavior (RSS reading,
search-over-feeds, auth email/password) is not flagged.

| Flag | Default | Gated capability | Required credentials when enabled |
| --- | --- | --- | --- |
| `FEATURE_GOOGLE_OAUTH` | false | Google OAuth sign-in via Better Auth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| `FEATURE_ONBOARDING` | false | First-run onboarding flow | none |
| `FEATURE_SOURCE_YOUTUBE` | false | YouTube source connector | `YOUTUBE_API_KEY` |
| `FEATURE_SOURCE_REDDIT` | false | Reddit source connector (public/app-credential only) | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` |
| `FEATURE_SOURCE_X` | false | X source connector (public/app-credential only) | `X_CLIENT_ID`, `X_CLIENT_SECRET` |
| `FEATURE_AI_ARTICLE_INTELLIGENCE` | false | Article summaries/tags/knowledge banks | `AI_PROVIDER`, `AI_API_KEY` |
| `FEATURE_SOCIAL_MODE` | false | Opt-in social mode (zen stays default) | none |
| `FEATURE_LINK_PREVIEWS` | false | Server-enriched reader link previews | none |
| `FEATURE_SHARE_PREVIEWS` | false | Kyomi-owned share target preview pages | none |
| `FEATURE_PUBLIC_API` | false | `/api/public/v1` developer API | none (per-key credentials issued at runtime) |
| `FEATURE_SELF_HOSTING_SETUP` | false | Local appliance / setup wizard | none |

The validation rule: a credential is required **only** when its matching feature flag is
enabled. With a flag disabled, missing credentials must not fail startup. This keeps
zero-credential local/self-hosted core setup working (roadmap self-hosting invariant).

## Public API rate limits

| Setting | Default | Meaning |
| --- | --- | --- |
| `PUBLIC_API_KEY_PREFIX` | `kyomi_pk_` | Non-secret identifying prefix for issued keys (logs use prefix/id only) |
| `PUBLIC_API_DEFAULT_RATE_LIMIT_PER_MINUTE` | 60 | Default per-key per-minute quota |
| `PUBLIC_API_DEFAULT_RATE_LIMIT_PER_DAY` | 10000 | Default per-key per-day quota |

Rate limiting must apply at multiple layers (key id, owner user id, route family, IP
fallback, global emergency limit). Query-string API keys are not accepted; keys travel in
`Authorization: Bearer <key>` only.

## AI provider

**Decision: `ai_provider_adapter`.** Kyomi will implement its AI service against a local
provider adapter interface rather than adopting a third-party SDK, until a stable official
SDK is verified for the Bun/TypeScript stack.

- TanStack AI SDK verification: **pending (no network access in the authoring session).**
  Package name, version, docs URL, and Bun compatibility must be confirmed before any
  install. Until then, do not add the package.
- The adapter can be backed by an approved provider (`AI_PROVIDER` + `AI_API_KEY`) or a
  local OpenAI-compatible endpoint / Ollama for self-hosting. AI is disabled by default.

## Public API key storage (Better Auth API-key plugin)

**Decision: pending verification; default to a local hashed-key implementation.**

- `@better-auth/api-key` compatibility with the current Better Auth + Drizzle + Bun +
  Postgres setup is **not yet verified (no network access in the authoring session).**
  Package name, version, docs URL, schema changes, rate-limit behavior, and permission model
  must be confirmed before adoption.
- Until verified, the public API child plan assumes a local implementation storing only key
  **hashes** (never plaintext). Keys are shown once at creation, never returned, never logged
  in full, and never accepted in query strings.

## Token vault (hard decision)

**`token_vault_required_for_user_platform_oauth = true`.** Reddit/X private or user-scoped
source access (home timelines, private follows, per-user OAuth, refresh-token storage) is
**out of scope** until a separate, reviewed token-vault child plan exists with encryption,
key rotation, revocation, and audit tests. Reddit/X v1 connectors are public-source or
app-credential only.

## Meilisearch index strategy

- Reuse the existing Meilisearch instance; do not add a second search engine.
- Treat indexes as rebuildable derivatives of Postgres. Feed and article indexes use
  versioned index names with atomic swaps and rollback.
- Feed documents gain `sourceKind`, `language`, `categories`, `contentType`, `qualityScore`,
  and `domain`; those become filterable attributes (Task 3).

## Link / share preview behavior

- Preview enrichment runs server-side through the existing safe outbound fetch policy;
  browsers never fetch arbitrary third-party preview URLs.
- Previews are cached and size-limited. A `Comments` anchor is related context, not article
  body — it may enrich a preview card but never replaces reader content.
- Share URLs are Kyomi-owned, re-check visibility on every request, and never include private
  user state in HTML, Open Graph metadata, or JSON hydration.

## Feed-follow SLOs

- API follow acknowledgement: `<100ms` p95 after auth/validation.
- Known-feed first visible items: `<300ms` p95 from cached Postgres/Meili data.
- Unknown-feed first visible items: `<2s` p50 / `<5s` p95 when the publisher responds
  normally. Sub-millisecond unknown-feed population is explicitly not a target.

## Durable ingestion / recovery posture

- Postgres is the durable ingestion and backfill ledger. Redis Streams transport work, but
  ingestion intent, attempts, outcomes, replay cursors, and backfill progress must be
  reconstructable from Postgres.
- Meilisearch is rebuildable from Postgres via versioned indexes and atomic swaps.
- Queue payloads that survive deploys are versioned before incompatible worker changes ship.

## Self-hosting image / distribution policy

- Canonical images: `ghcr.io/kyomi/{web,api,worker,catalog,local}`. Docker Hub may mirror
  `kyomi/{web,api,worker,catalog,local}`; GHCR remains canonical provenance.
- Core reading, RSS, search, saved/read state, and OPML work with no third-party
  credentials. Optional integrations advertise disabled status with enablement steps.

## Social privacy defaults

- New users start in zen default. Profiles are private until explicitly created. Read
  activity is private until sharing is explicitly enabled. Sharing is evaluated per event at
  read and display time. Knowledge banks are private by default.

## Public API v1 exposure matrix

| Resource | Allowed fields (v1) | Denied fields | Scope | Rate-limit bucket | Privacy test |
| --- | --- | --- | --- | --- | --- |
| Feeds | id, title, description, siteUrl, sourceKind, categories, language | folder membership, private subscription notes | `feeds:read` | key + owner | feed-owner-scope leak test |
| Feed items | id, title, canonicalUrl, summary, publishedAt, author, sourceKind, tags, categories | read/saved/hidden state, clips, private notes, private annotations | `items:read` | key + owner | item-private-state leak test |
| Search | accessible feed-item hits, honest pagination | global hit counts, unauthorized feeds | `search:read` | key + owner + route | search-access-scope leak test |
| Tags & categories | slug, label, provenance (when safe) | none beyond provenance policy | `tags:read` | key + owner | tag-dictionary scope test |
| Share targets | slug, kind, visibility for objects the principal can access | private-state entities | `shares:write` | key + owner | share-visibility recheck test |
| Usage | own key metadata, own usage summary | cross-user usage, raw request logs | `usage:read` | key + owner | cross-user-usage leak test |
| Social profiles | not exposed in v1 | all | — | — | — |
| Knowledge banks | not exposed in v1 | all | — | — | — |
| Source connector mgmt | not exposed in v1 | all | — | — | — |

## External source quota / retention notes

- **Google OAuth**: no content quota; retains only Better Auth session/account records.
  Follows Better Auth Google provider config and `/api/auth/callback/google`.
- **YouTube Data API v3**: daily quota units per project; cache video/playlist/caption
  metadata. Do not download or store video files. Respect API terms.
- **Reddit API**: OAuth app-credential rate limits apply. v1 is public-source only; store
  only public post metadata and capped public discussion excerpts. No comment-tree archival.
- **X API v2**: timeline access limits and tiered quotas. v1 is public/app-credential only;
  store only public post metadata. No posting/voting/replying.
- **AI provider**: per-provider token/rate limits. Validate structured outputs, store
  provenance + confidence, never trust raw LLM output. Do not train on user reading history.

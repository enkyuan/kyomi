## Learned User Preferences
- Follow attached implementation plans exactly and do not edit the plan file.
- Reuse existing plan to-dos; do not recreate them, and move statuses in order while executing.
- Prioritize deep root-cause diagnosis and clean, standards-based fixes over quick/hacky workarounds or patch-style bandaids.
- When asked to refactor, preserve behavior and avoid runtime regressions.
- Apply UI feedback literally and iteratively with precise visual adjustments; prefer Tailwind utility classes over inline styles for small layout and typography tweaks in `apps/web` when both are viable.
- For form UX, show validation errors per-field (not all at once) and only when relevant.
- Keep `AGENTS.md` updates minimal: only high-signal, durable bullets—avoid verbose dumps.
- For reader/article HTML in `apps/web`, prefer conservative DOM inspection and explicit enhancement in `render-html.tsx` (`data-*` markers) over broad structural CSS (`:has(...)`) that can match whole-article wrappers.
- In reader code blocks, trust explicit fence or `language-*` / `lang-*` hints for highlight.js; avoid aggressive auto-detection when the language is unknown so snippets are not mislabeled.
- For reader font-size controls with live preview, keep preview and persisted preferences on one synchronized value path to avoid flicker and px snap near close (no competing updates or races).
- Prefer `bunx` over `npx` for one-off CLI tooling in this repo.

## Learned Workspace Facts
- This workspace is a monorepo centered on `apps/web`, `apps/api`, and `packages/catalog`.
- `packages/catalog` is an optional offline Python enrichment island; normal app runtime/setup (`bootstrap`, `dev:app`, routine TS checks) must not require Poetry or catalog sync.
- Feed discovery/follow and inbox filtering work spans both `apps/web` and `apps/api`.
- Local catalog sync script lives at `packages/catalog/scripts/sync.sh`.
- Root scripts include a convenience command for local sync via `catalog:sync:local`.
- Catalog’s shared Python feed/catalog helpers live under `packages/catalog/feed` (import as `feed`; formerly `readspace`). `feed/favicon.py` imports PyPI `extract-favicon`—keep it declared in `packages/catalog/pyproject.toml` and installed in the Poetry env so analysis tools resolve imports.
- Shared article HTML sanitization package: `packages/sanitization` (`@cronos/sanitization`), replacing the older `article-html-sanitize` layout.
- Article/datetime handling: APIs expose instants as UTC ISO strings; inbox day-scoped filters use the client’s `timezoneOffsetMinutes` to derive UTC `published_after` / `published_before` bounds, so calendar-day semantics are not enforced only inside the API layer.
- Database schema is split into domain modules under `packages/db/src/schema/` (for example auth, feeds, articles, preferences, organizations, misc) and composed for `@cronos/db` consumers instead of one monolithic schema file.
- Reader and article presentation should follow one explicit contract between API article normalization/detail and `apps/web` reader components—avoid duplicating normalization, render-mode choice, or ad hoc fallbacks across layers.

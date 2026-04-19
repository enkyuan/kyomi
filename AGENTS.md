## Learned User Preferences
- Follow attached implementation plans exactly and do not edit the plan file.
- Reuse existing plan to-dos; do not recreate them, and move statuses in order while executing.
- Prioritize deep root-cause diagnosis and standards-based fixes over quick or hacky workarounds.
- When asked to refactor, preserve behavior and avoid runtime regressions.
- Apply UI feedback literally and iteratively with precise visual adjustments.
- For form UX, show validation errors per-field (not all at once) and only when relevant.
- Keep `AGENTS.md` updates minimal: only high-signal, durable bullets—avoid verbose dumps.
- For reader/article HTML in `apps/web`, prefer conservative DOM inspection and explicit enhancement in `render-html.tsx` (`data-*` markers) over broad structural CSS (`:has(...)`) that can match whole-article wrappers.

## Learned Workspace Facts
- This workspace is a monorepo centered on `apps/web`, `apps/api`, and `packages/sangam`.
- Feed discovery/follow and inbox filtering work spans both `apps/web` and `apps/api`.
- Local catalog sync script lives at `packages/sangam/scripts/sync.sh`.
- Root scripts include a convenience command for local sync via `catalog:sync:local`.
- Sangam’s shared Python feed/catalog helpers live under `packages/sangam/feed` (import as `feed`; formerly `readspace`, then `sangam_feed`). `feed/favicon.py` imports PyPI `extract-favicon`—keep it declared in `packages/sangam/pyproject.toml` and installed in the Poetry env so analysis tools resolve imports.
- Shared article HTML sanitization package: `packages/sanitization` (`@cronos/sanitization`), replacing the older `article-html-sanitize` layout.

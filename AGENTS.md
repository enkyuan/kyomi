## Learned User Preferences
- Follow attached implementation plans exactly and do not edit the plan file.
- Reuse existing plan to-dos; do not recreate them, and move statuses in order while executing.
- Prioritize deep root-cause diagnosis and standards-based fixes over quick or hacky workarounds.
- When asked to refactor, preserve behavior and avoid runtime regressions.
- Apply UI feedback literally and iteratively with precise visual adjustments.
- For form UX, show validation errors per-field (not all at once) and only when relevant.

## Learned Workspace Facts
- This workspace is a monorepo centered on `apps/web`, `apps/api`, and `packages/sangam`.
- Feed discovery/follow and inbox filtering work spans both `apps/web` and `apps/api`.
- Local catalog sync script lives at `packages/sangam/scripts/sync.sh`.
- Root scripts include a convenience command for local sync via `catalog:sync:local`.

# TODOs

Deferred work captured with enough context to pick up later. Add new entries at the top.

## Add a Playwright/visual-regression harness for responsive breakpoints

- **What:** Stand up a minimal Playwright (or equivalent) visual-regression suite for `apps/web`,
  starting with the shell max-width ladder and inbox recap-rail breakpoints introduced in
  `docs/superpowers/plans/2026-08-26-desktop-responsive-shell.md`.
- **Why:** That plan fixes `apps/web`'s desktop/laptop responsiveness (the app shell was frozen at a
  static `84rem` max-width regardless of viewport). Its regression coverage is necessarily limited to
  Vitest/JSDOM class-presence assertions and generated-CSS grep checks, plus a one-time manual
  multi-viewport browser pass — JSDOM does not evaluate CSS media queries, so it cannot verify actual
  rendered width at a given viewport size. There is currently no repeatable, automated guard against a
  future regression back to a frozen/static shell width, or against silent breakage of the
  container-width-driven recap rail.
- **Pros:** Catches real visual/layout regressions (not just "the right class string is present") at
  the exact breakpoints this plan cares about; extends naturally to other `apps/web` surfaces later;
  gives the `md` 768→800px Tailwind/`useMediaQuery` alignment (also introduced by that plan) an
  automated tripwire instead of relying on a one-time manual audit.
- **Cons:** No Playwright/e2e harness exists in this repo today (confirmed: no `playwright.config.*`
  anywhere in the tree) — this is a new tooling investment (browser install/CI runtime, baseline
  screenshot management, flakiness triage), not a small addition to the existing Vitest suite. Scoping
  it narrowly to "just the shell ladder" risks under-building the harness in a way that has to be
  redone when the next surface needs visual coverage.
- **Context:** See `docs/superpowers/plans/2026-08-26-desktop-responsive-shell.md`, especially
  "Track B" (Tasks 2–3, the shell max-width ladder and recap rail) and Task 5 (the current, necessarily
  partial regression coverage: class-presence Vitest tests + a build-output CSS grep for the
  `--breakpoint-*` tokens added in Task 1). The breakpoint values live in
  `packages/ui/src/hooks/use-media-query.ts` (`BREAKPOINTS`) and `packages/ui/src/styles/theme.css`
  (`@theme inline` `--breakpoint-*` tokens) — a visual-regression suite should assert against those
  same values so it can't silently drift from the JS/CSS breakpoint contract.
- **Depends on / blocked by:** Nothing blocking; can start any time after the 2026-08-26 plan lands.
  Decide the runner (Playwright is the most common fit for a TanStack Start/Vite app) and where its
  config/tests live (likely a new `tests/web/e2e` or similar, sibling to `tests/web/integration`) as
  part of scoping it, rather than assuming Playwright specifically.

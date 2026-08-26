# Desktop/Laptop Responsive Shell Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Work Track A before
> Track B; Track C depends on Track A landing first. Do not touch `apps/mobile` — mobile
> responsiveness is explicitly out of scope for this plan.

**Goal:** Make `apps/web` genuinely responsive across the full desktop/laptop width range (~1024px
laptop through 4K/ultra-wide external monitors), instead of freezing at one fixed width once the
viewport exceeds ~1344px. Fix the breakpoint drift between the shared `useMediaQuery` hook and
Tailwind's generated `md:`/`2xl:` utilities so JS-computed and CSS-computed layout state agree, and
wire up the already-defined `2xl`/`3xl`/`4xl` tiers so wide/ultra-wide monitors get an intentional
layout instead of dead space.

**Architecture:** `apps/web/src/app/app-shell.tsx` is the single wrapper rendered by
`routes/_app/route.tsx` for every authenticated route (inbox, feeds, folders, settings). It
currently hardcodes `maxWidth: "84rem"` as an inline style and centers the whole app (sidebar +
content) inside a `justify-center` flex row. Above ~1344 CSS px — the majority of real laptop
(1440/1512/1536) and desktop/external-monitor (1920/2560/3440/3840) viewports — the app stops
growing and just floats centered with static empty gutters on both sides. Because this is the one
shared shell, fixing it is the single highest-leverage change: every route benefits without
per-page work. Layered on top, `packages/ui/src/hooks/use-media-query.ts` defines a
`BREAKPOINTS` table with `md: 800`, `2xl: 1536`, `3xl: 1600`, `4xl: 2000`, but no
`--breakpoint-*` override exists in `packages/ui/src/styles/theme.css` or
`apps/web/src/styles.css`, so Tailwind's generated `md:`/`2xl:` (etc.) utilities silently use
Tailwind's own defaults (768/1536) instead. That mismatch creates dead zones where a component's
JS-computed state (via the hook) and its Tailwind classes disagree, and it means the `3xl`/`4xl`
tiers the hook already exposes are not usable as Tailwind variants at all today — a search of
`apps/web/src` confirms zero usages of `3xl:`/`4xl:` and exactly one usage of `2xl:` anywhere in the
app.

**Tech Stack:** React 19, TanStack Start/Router, Tailwind CSS v4 (`@theme inline`), `@kyomi/ui`
shared package, Vitest + Testing Library for integration tests.

---

## Global Constraints

- Do not change sidebar placement or make it collapsible/resizable. Per established product
  direction, the navigation sidebar stays on the left, at its current fixed icon-rail width
  (`APP_SIDEBAR_WIDTH = "5rem"`), at every breakpoint. This plan only changes how much width the
  _content_ column claims, never sidebar behavior.
- Do not touch `apps/mobile` or any `max-md`/mobile-only code paths. The user has explicitly scoped
  this work to desktop/laptop only.
- Keep the existing container-width-driven inbox split/stacked logic
  (`useResponsiveReaderMode` in `apps/web/src/modules/inbox/hooks/use-layout.ts`) intact; this plan
  extends the _wide_ end of that spectrum, not the narrow/mobile end.
- Prefer Tailwind utility classes over new inline styles for the shell width change, consistent
  with existing web-module conventions.
- Any breakpoint value changed in `packages/ui/src/hooks/use-media-query.ts` or
  `packages/ui/src/styles/theme.css` is a shared-package change — treat it as such: check every
  current consumer (`sidebar` state provider, `use-layout.ts`, `toolbar` hooks,
  `reader/components/toolbar`) for behavior changes before landing, per `$packages`.
- Use `bunx`, not `npx`, for any one-off CLI tooling needed during this work.

---

## Audit Baseline and Scope

### What already exists

- `apps/web/src/app/app-shell.tsx` renders a single grid (`auto minmax(0, 1fr)`) for sidebar +
  content, capped with an inline `style={{ maxWidth: "84rem", ... }}` and centered via
  `justify-center` on its parent. This is the only place that constrains the app's overall width.
- `packages/ui/src/hooks/use-media-query.ts` already defines a rich breakpoint table (`sm` 640,
  `md` 800, `lg` 1024, `xl` 1280, `2xl` 1536, `3xl` 1600, `4xl` 2000) and a generic `useMediaQuery`
  API (`min`/`max`/string shorthand) plus `useIsMobile()`.
- `apps/web/src/modules/inbox/hooks/use-layout.ts` (`useResponsiveReaderMode`) already does the
  _right_ thing for the narrow end: it prefers a measured container width
  (`useViewport` in `apps/web/src/hooks/use-viewport.ts`) over a raw viewport media query, so the
  inbox split/stacked decision reflects actual available space, not just window width.
  `apps/web/src/modules/inbox/page.tsx` reuses that same container ref for `layoutContainerWidth`.
- The inbox recap rail (`<aside className="hidden h-full w-96 shrink-0 flex-col py-4.5 xl:flex">`
  in `apps/web/src/modules/inbox/page.tsx`) is the only `2xl:`/`3xl:`/`4xl:`-tier-adjacent
  responsive class in the entire `apps/web/src` tree (it currently only reaches `xl:`, 1280px
  under Tailwind's default scale), and it is keyed to raw viewport width rather than the
  `layoutContainerWidth` the rest of the page already measures.
- `packages/ui/src/styles/theme.css` defines an `@theme inline` block for colors/fonts/radii but no
  `--breakpoint-*` tokens, so Tailwind's `md`/`2xl` breakpoints resolve to Tailwind's built-in
  defaults (768px / 1536px) rather than the hook's `800` / `1536`. (`2xl` happens to already match;
  `md` does not.)
- `apps/web/src/modules/settings/components/dialog/index.tsx` and the folder/feed management
  dialogs already use `md:`-scoped Tailwind max-width/max-height classes for their popups; these
  are viewport-appropriate as dialogs and are not part of this plan's scope.

### In scope

1. Replace the app shell's single static `maxWidth: 84rem` with a breakpoint-driven content-width
   ladder so the app keeps growing (in graduated steps, not unboundedly) as the viewport grows from
   a typical laptop width up through 4K/ultra-wide external monitors.
2. Align Tailwind's generated breakpoint utilities with `useMediaQuery`'s `BREAKPOINTS` table (in
   particular `md`, `3xl`, `4xl`) so a single breakpoint vocabulary drives both CSS and JS layout
   decisions, with no dead zones between them.
3. Use the newly-aligned `2xl`/`3xl`/`4xl` tiers to give the inbox recap rail (and, if warranted
   after review, the reader's wide-content ceiling) an intentional treatment on very wide desktop
   viewports, instead of leaving reclaimed shell width unused.
4. Switch the recap rail's visibility check from a raw viewport media query to the same measured
   `layoutContainerWidth` the rest of `InboxPageContent` already uses, so it agrees with the
   split/stacked decision made by `useResponsiveReaderMode`.
5. Regression tests that pin the shell's width behavior at representative laptop/desktop/ultra-wide
   viewports and the aligned breakpoint values.

### Explicitly not in scope

- Any `apps/mobile` change. Mobile responsiveness belongs to the `$mobile` skill and is out of
  scope here.
- Any `max-md`/mobile-web layout change (sidebar sheet, `MobileLayout`, mobile list/detail
  stacking). This plan only changes behavior at `md` and above.
- Making the sidebar collapsible, resizable, or wider/narrower per breakpoint. It stays fixed at
  `APP_SIDEBAR_WIDTH`.
- Redesigning the inbox split-view internals (list/detail proportions), the settings dialog, or any
  feed/folder management dialog sizing. Those already scope themselves reasonably to their content
  and are not part of the "shell never adapts" problem being fixed here.
- Reworking `useMediaQuery`'s API shape. This plan only changes the _values_ it's keyed to and adds
  matching Tailwind theme tokens, not its signature or call sites' logic.

### Current vs. target shell behavior

```text
Current:
  viewport < 1344px  -> shell fills viewport width (grid is w-full, capped by viewport itself)
  viewport >= 1344px -> shell frozen at 1344px, centered, growing viewport adds only side gutters

Target:
  viewport < xl   (1280px)  -> shell fills viewport width (unchanged)
  xl   - 2xl (1280-1536px)  -> shell caps at current ~84rem (1344px)
  2xl  - 3xl (1536-1600px)  -> shell caps at a modestly larger ceiling
  3xl  - 4xl (1600-2000px)  -> shell caps at a larger ceiling still
  4xl+       (2000px+)      -> shell caps at a final ceiling; never grows unboundedly
```

Exact ceiling values are chosen in Task 1 based on what keeps the recap rail and list/detail
columns comfortable, not by mechanically scaling `84rem` — see Task 1's acceptance notes.

---

## File Structure

| File                                                                                               | Responsibility                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/styles/theme.css`                                                                 | Add `--breakpoint-md`, `--breakpoint-3xl`, `--breakpoint-4xl` (and confirm `--breakpoint-2xl`) to `@theme inline` so Tailwind matches `useMediaQuery`.            |
| `packages/ui/src/hooks/use-media-query.ts`                                                         | No value changes expected (table becomes the source of truth other files must match); add a code comment pointing at the theme file so the two don't drift again. |
| `apps/web/src/app/app-shell.tsx`                                                                   | Replace the single inline `maxWidth: "84rem"` with a Tailwind responsive max-width ladder.                                                                        |
| `apps/web/src/modules/inbox/page.tsx`                                                              | Make the recap rail's visibility and width responsive across `xl`/`2xl`/`3xl`, driven by the existing measured container width instead of a raw viewport query.   |
| `tests/web/integration/src/app/app-shell.test.tsx` (new)                                           | Pin shell width behavior at representative viewports.                                                                                                             |
| `tests/web/integration/src/modules/inbox/page.test.tsx` or nearest existing inbox page/layout test | Extend/add coverage for recap rail visibility across the aligned breakpoints.                                                                                     |

---

## Track A — Align the shared breakpoint vocabulary

### Task 1: Add matching `--breakpoint-*` tokens to the shared Tailwind theme

- [ ] In `packages/ui/src/styles/theme.css`, inside the existing `@theme inline` block, add:
  - `--breakpoint-md: 800px;` (currently drifts from Tailwind's default `768px`; must match
    `useMediaQuery`'s `md: 800`).
  - `--breakpoint-3xl: 1600px;` and `--breakpoint-4xl: 2000px;` (currently undefined; these tiers
    are unreachable from Tailwind classes today).
  - Confirm `--breakpoint-2xl` is either already `1536px` under Tailwind's default (it is) or add
    an explicit `--breakpoint-2xl: 1536px;` for clarity/symmetry with the other custom tiers.
  - Leave `sm`/`lg`/`xl` alone — they already match `useMediaQuery`'s `640`/`1024`/`1280`.
- [ ] Add a one-line comment above the block noting that these values must stay in sync with
      `BREAKPOINTS` in `packages/ui/src/hooks/use-media-query.ts`, and vice versa (add the mirroring
      comment in `use-media-query.ts` too).
- [ ] Audit every existing `md:`-scoped Tailwind class in `apps/web/src` and `packages/ui/src` for
      behavior change now that `md` moves from `768px` to `800px` (a ~32px band). Pay particular
      attention to:
  - `packages/ui/src/sidebar/components/index.tsx` (`md:block`, `md:flex` on the desktop sidebar
    branch) — confirm no regression, since `AppSidebar` uses `collapsible="none"` and therefore
    never takes the `isMobile` JS branch; this class only matters for other `Sidebar` consumers, if
    any (grep for `collapsible=` usages other than `"none"` in `apps/web`).
  - `apps/web/src/modules/inbox/components/list/index.tsx` (`md:min-h-0`) and
    `apps/web/src/modules/reader/components/detail/index.tsx` (`md:min-h-0`).
  - `apps/web/src/modules/reader/components/detail/content/article.tsx`
    (`max-md:aspect-square max-md:px-0 md:h-8 md:gap-2 ...`).
  - `apps/web/src/modules/toolbar/hooks/use-floating.ts` and
    `apps/web/src/modules/reader/components/toolbar/index.tsx` (both call
    `useMediaQuery({ max: "md" })`/`{ min: "md" }` already, so these become _more_ correct, not
    less, once Tailwind agrees).
  - `apps/web/src/modules/inbox/hooks/use-layout.ts` (`useResponsiveReaderMode`) — its own
    `INBOX_DESKTOP_MIN_WIDTH_PX = 768` constant is independent of the `md` breakpoint (it's a
    container-width threshold, not a viewport one); confirm this is intentional and leave it as-is
    unless the review in Task 6 says otherwise.
- [ ] Acceptance: run `bun run --cwd apps/web build`, then grep the built CSS output (e.g.
      `apps/web/.output/**/*.css` or the Vite build's asset output — confirm the exact path once the
      build runs) for `@media (min-width: 800px)`, `@media (min-width: 1600px)`, and
      `@media (min-width: 2000px)`. This is a build-output check, not a Vitest/JSDOM assertion — JSDOM
      does not evaluate CSS media queries against a simulated viewport, so breakpoint correctness can
      only be confirmed from the generated CSS (or a real browser), not from a component render test.
      No visual regression in the 768–800px band for any of the audited call sites above (confirmed
      manually in Task 6).

---

## Track B — Make the app shell scale with the viewport

### Task 2: Replace the static shell max-width with a responsive ladder

- [ ] In `apps/web/src/app/app-shell.tsx`, remove `maxWidth: "84rem"` from the inline `style`
      object on the shell's inner grid `div`.
- [ ] Add a Tailwind `max-w-*` responsive class ladder to that same element instead, e.g.
      (exact tokens to be finalized against the design skill's visual review, but the shape is):
      `"max-w-none xl:max-w-[84rem] 2xl:max-w-[90rem] 3xl:max-w-[100rem] 4xl:max-w-[112rem]"`.
      Extract this string as a named constant (e.g. `SHELL_MAX_WIDTH_CLASS`) next to the existing
      `GRID_TEMPLATE_COLUMNS` constant in the same file, rather than inlining it into the JSX — the
      file already establishes that convention for the shell's other layout literals
      (`GRID_TEMPLATE_COLUMNS`, `APP_SIDEBAR_WIDTH`), so the width ladder should follow it too.
  - Below `xl` (1280px): no cap — the shell already fills the viewport today at these widths
    (matches current behavior exactly, since `84rem` = 1344px was never reached below that anyway
    on any viewport this app supports below `lg`).
  - `xl`–`2xl` (1280–1536px): keep today's `84rem` ceiling unchanged, so nothing regresses for the
    most common laptop widths.
  - `2xl` and above: step the ceiling up in the increments shown so a 1920px, 2560px, 3440px, or
    3840px display all get visibly more usable content width than today, while the layout never
    grows unboundedly (which would make list rows and reader lines uncomfortably wide).
- [ ] Load `$design` before finalizing the exact ceiling numbers above; validate them against the
      reader's existing `max-w-5xl`/`max-w-2xl` content constraints (`apps/web/src/modules/toolbar/hooks/use-display.ts`)
      and the inbox recap rail width from Task 3, so the extra shell width is visibly used by real
      content (wider recap rail, more breathing room around the list/detail columns) rather than
      producing new internal dead space one level down.
- [ ] Confirm `justify-center` on the shell's outer wrapper still centers the (now-wider-at-large-
      breakpoints) grid correctly, and that `overflow-hidden`/`min-h-0` behavior is unaffected.
- [ ] Acceptance: the shell element carries exactly the class tokens in the ladder above (verified
      by the Task 5 class-presence test, which is what Vitest/JSDOM can actually check here — JSDOM
      does not evaluate CSS media queries, so it cannot confirm rendered width at a given viewport
      size). The actual rendered width at 1024px, 1280px, 1440px, 1536px, 1920px, 2560px, and 3840px
      is confirmed manually in a real browser during Task 6.
- [ ] **Design polish note (`make-interfaces-feel-better` / `emil-design-eng`):** do not add a
      `transition` on the ladder's `max-width`. Per the animation decision framework, first ask
      whether this should animate at all — a breakpoint-driven `max-width` change only fires while a
      user is actively dragging the OS window edge (continuous, high-frequency during that drag) or,
      much more rarely, on load. `max-width` also isn't compositor-only (it forces layout), so
      animating it during a continuous drag-resize is exactly the case the performance principle
      ("only animate `transform`/`opacity`") warns against. Leave the ladder as plain, un-transitioned
      Tailwind classes — this is a deliberate no-animation decision, not an oversight.

### Task 3: Drive the inbox recap rail from measured content width, and widen it at wide tiers

- [ ] In `apps/web/src/modules/inbox/page.tsx`, replace the recap rail's `hidden ... xl:flex`
      visibility class with a check derived from the same `layoutContainerWidth` value already
      computed via `useViewport(layoutContainerRef)` for `useResponsiveReaderMode`, so the rail's
      appearance is consistent with the split/stacked decision made a few lines above it and reacts to
      the sidebar being present/absent, not just raw window width.
  - If a purely container-width-driven show/hide introduces layout-measurement flicker on first
    paint, keep a CSS-based `xl:flex` as the SSR-safe default and layer the container-width check
    on top only to _hide_ the rail when the measured space is too tight, rather than replacing the
    CSS breakpoint outright — pick whichever avoids a hydration flash, and record the choice and
    why in a comment above the `aside`.
- [ ] Widen the rail across the aligned tiers instead of a single `w-96`: e.g.
      `"w-80 2xl:w-96 3xl:w-[26rem]"` (exact values reviewed alongside Task 2's shell ceilings so the
      rail's growth and the shell's growth are proportionate, not just both growing independently).
- [ ] Acceptance: the recap rail is visible whenever there is genuinely enough measured width for
      it (matching the previous `xl:` visual threshold at minimum), grows modestly at `2xl`/`3xl`, and
      never appears when the measured content column is too narrow even if the raw viewport is wide
      (e.g., a maximized-but-narrow split-screen browser window).
- [ ] **Design polish (`make-interfaces-feel-better` / `emil-design-eng`):** once visibility is
      driven by measured width instead of a static `xl:flex`, the rail can appear/disappear during an
      ordinary window resize, not just on page load — an abrupt `hidden`→`flex` snap reads as broken
      per "elements appearing or disappearing without transition feel broken." This is an occasional
      event (resize crossing a threshold), not a high-frequency one, so a small transition is
      justified. Reuse the `@kyomi/ui/motion` `LazyMotion`/`m`/`domAnimation` + `AnimatePresence`
      pattern already used a few lines above for `feedTransition` and in
      `apps/web/src/modules/inbox/components/list/index.tsx`'s header controls, gated on the existing
      `useReducedMotion()` convention from that same file — do not introduce a second animation
      approach for one element on the same page.

| Before                                                                                                                | After                                                                                                                                                                                                                                                                                | Why                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<aside className="hidden h-full w-96 shrink-0 flex-col py-4.5 xl:flex">` snaps in/out with the container-width check | Wrap the rail's mount/unmount in `AnimatePresence` with `initial={{ opacity: 0, scale: 0.96 }}` / `animate={{ opacity: 1, scale: 1 }}` / `exit={{ opacity: 0, scale: 0.98 }}`, `transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", duration: 0.28, bounce: 0 }}` | Never animate from `scale(0)`; exits should be subtler than enters; matches the existing spring config already used for `scopeControlTransition` in `list/index.tsx` instead of inventing a new easing/duration for this one surface |

### Task 4: Sweep for other single-breakpoint desktop toggles that should extend to wide tiers

- [ ] Grep `apps/web/src` for any other component that only branches at `md:`/`lg:`/`xl:` with no
      treatment above that (the recap rail was the only pre-existing `xl:`-tier example found during
      planning, but re-check after Tasks 1–3 land in case new call sites were touched). Candidates to
      double check: `apps/web/src/modules/settings/components/**`, folder/feed management dialogs, and
      the reader toolbar's `useReaderDisplay` max-width classes.
      Load `$web` and `$design` for this sweep; only add new wide-tier classes where the design review
      agrees there's a real content benefit — do not add `3xl:`/`4xl:` variants speculatively.
- [ ] Document any deliberately-out-of-scope findings (e.g., "settings dialog width is intentionally
      static because it's a fixed-content form, not a content-scaling surface") directly as code
      comments near the affected class, so a future audit doesn't re-flag them.

---

## Track C — Regression coverage

### Task 5: Pin shell and recap-rail width behavior with integration tests

- [ ] Add `tests/web/integration/src/app/app-shell.test.tsx` (mirrors
      `apps/web/src/app/app-shell.tsx` per the existing `tests/web/integration/src/app/*.test.tsx`
      convention). **Correction from the initial draft:** the existing `useMediaQuery` mocking
      pattern in this repo (`tests/web/integration/src/modules/inbox/components/page/article/toolbar.test.tsx`
      and `tests/web/integration/src/modules/reader/components/toolbar/index.test.tsx` both do
      `vi.mock("@kyomi/ui/hooks/use-media-query", () => ({ useMediaQuery: () => false }))`) only
      fixes one boolean; it cannot exercise a multi-tier CSS breakpoint ladder, and Vitest/JSDOM does
      not evaluate CSS media queries against a simulated viewport at all — there is no `useMediaQuery`
      call involved in Task 2's shell change, since the ladder is pure Tailwind classes. So this test
      must assert **class presence**, not rendered width:
  - The shell's inner grid element's `className` contains the exact ladder tokens from Task 2
    (e.g. `xl:max-w-[84rem]`, `2xl:max-w-[90rem]`, `3xl:max-w-[100rem]`, `4xl:max-w-[112rem]`) and
    no literal `maxWidth` inline style remains.
  - No max-width cap class applies below `xl` (i.e. the ladder's base is `max-w-none`).
- [ ] Extend the nearest existing inbox page/layout test (or add one under
      `tests/web/integration/src/modules/inbox/`) to cover the parts of Task 3 that genuinely are
      runtime-testable in JSDOM (these ARE testable, unlike the shell ladder, because
      `useViewport`'s `ResizeObserver`-based container-width measurement runs real JS — mock
      `ResizeObserver` and `clientWidth` the way
      `tests/web/integration/src/modules/feeds/components/follow/dialog.test.tsx` already does):
  - The recap rail's visibility follows measured container width, not raw viewport width, per
    Task 3.
  - Width-class selection at the container-width thresholds Task 3 defines (if that part of Task 3
    stays CSS-only per its own flicker/hydration caveat, assert class presence the same way as the
    shell ladder instead).
- [ ] Add a small non-Vitest check (a short script, or a step in the Task 1 acceptance criterion's
      build-output grep — not a Vitest test, since this is a generated-CSS property, not a component
      behavior) that asserts the built CSS contains `@media (min-width: 800px)`, guarding against
      future drift between `packages/ui/src/styles/theme.css` and
      `packages/ui/src/hooks/use-media-query.ts`. Wire it into the same CI step that already runs
      `bun run --cwd apps/web build`, immediately after the build, rather than as a Vitest test file.
- [ ] Run the narrowest relevant Vitest target first, then broaden:
      `bun run --cwd apps/web test -- app-shell`, then the full `tests/web` suite.

---

## End-to-End Validation and Rollout

### Task 6: Validate and review before rollout

- [ ] Run `bun run --cwd apps/web typecheck`, `bun run --cwd apps/web lint`, and
      `bun run --cwd apps/web fmt:check`.
- [ ] Run `bun run --cwd apps/web build` (this plan touches SSR'd shell markup and shared package
      styles, so a production build is required, not just dev-server verification).
- [ ] Manually verify in a real browser (not just devtools device toolbar, which can misreport
      effective viewport vs. actual monitor width) at representative widths: a 13"/14" laptop
      (~1280–1512px), a 16" laptop (~1512–1728px), a 1440p external monitor (2560px), and, if
      available, a 4K/ultra-wide monitor (3840px/3440px). Confirm:
  - The shell visibly uses more width at each successive tier (no more frozen-at-1344px gutters).
  - The recap rail appears/grows at the right tiers and never appears when the browser window
    itself is narrow, even while the OS-level monitor is wide.
  - Reader content width, list row width, and toolbar layouts still read comfortably — no line
    lengths or list rows that became too wide to scan easily as a side effect of the wider shell.
  - The 768–800px `md` realignment introduced no visual regression (spot-check the sidebar,
    reader toolbar, and inbox list header at exactly 780px and 810px).
- [ ] Finish through `$qa` for the aggregate check (formatting, lint, typecheck, boundary checks,
      tests, build) before treating this plan as complete.

---

## Follow-on Decision Gates

- If the Task 6 manual review finds the reader's own `max-w-5xl` content ceiling now looks
  cramped relative to the wider shell/recap rail at `3xl`/`4xl`, that is a deliberate, separate
  product decision (reader typography/line-length is a `$design` call, not an incidental shell
  side effect) — raise it as a follow-up rather than silently widening reader content inside this
  plan.
- If Task 4's sweep finds several more single-breakpoint desktop toggles worth extending, batch
  them into a small follow-up pass rather than growing this plan's diff further; this plan's core
  deliverable is the shell + recap rail + breakpoint alignment.
- **Resolved — decision A:** this repo has no Playwright/visual-regression harness (confirmed: no
  `playwright.config.*` anywhere in the tree), so every breakpoint claim in this plan is verified
  either as a generated-CSS/class-presence check or a one-time manual browser pass in Task 6 — there
  is no repeatable, automated guard against a future regression to the frozen-max-width behavior this
  plan fixes. Logged as deferred work in `TODOS.md` ("Add a Playwright/visual-regression harness for
  responsive breakpoints") rather than built inside this plan or skipped outright — a full
  visual-regression harness is a repo-wide investment that deserves its own scoping, not a rider on
  this plan's diff. This plan proceeds with the class-presence/build-output coverage in Task 5 as its
  complete (not partial-pending-a-decision) regression story.

### Failure modes (required output)

| Codepath                                  | Failure mode                                                                                                       | Test coverage                                                                                                                                                                        | Error handling                                          | User-visible?                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Shell max-width ladder (Task 2)           | A future edit reintroduces a static `maxWidth` inline style, silently overriding the Tailwind ladder again         | Task 5's class-presence test only catches a missing class, not a _reintroduced_ inline style unless it also asserts no inline `maxWidth`/`max-width` remains (added to Task 5 above) | None needed — it's a static style, not a runtime branch | Yes, silently — shell freezes again with no error, only a UX regression                               |
| Recap rail container-width check (Task 3) | `layoutContainerWidth` is `0` on first render (before `ResizeObserver` fires) and the rail flickers in/out on load | Existing `useViewport` hook already returns `0` initially; Task 3's own hydration-flash caveat addresses this by keeping a CSS-based default                                         | Handled by design (CSS fallback), not by a thrown error | Only if the CSS-fallback choice in Task 3 is skipped                                                  |
| `md` breakpoint realignment (Task 1)      | A `packages/ui` consumer keyed to the old `768px` value elsewhere in `apps/web` was missed by the audit            | Task 1's audit list is enumerated from a full-repo grep in this planning pass, but is not itself re-run automatically if new `md:` usages are added later                            | None — relies on the one-time audit                     | Yes, silently — a missed call site would look subtly wrong at 768–800px, easy to miss in a quick pass |

None of these are **critical gaps** (no failure mode here is both untested and unhandled and silent) — each has at least a partial mitigation already in the plan, but the last row (missed `md:` call site) has the weakest guardrail and is worth a deliberate glance during Task 6's manual pass rather than assuming Task 1's grep was exhaustive.

---

## Plan Review Notes (self-review detail)

This plan was authored and self-reviewed against `$architecture` (single shared-shell leverage
point identified via `AppShell`'s exclusive use in `routes/_app/route.tsx`; breakpoint values
treated as a `packages/ui` shared-package contract per `$packages`), `$design` (wide-tier ceilings
deferred to visual review rather than hardcoded speculatively), and `$testing`/`$qa` (new coverage
mirrors the existing `tests/web/integration/src` path convention; validation ends through `$qa`).

The manual review additionally focused on:

- **Scope correctness:** confirmed via `grep`/`ast-grep`-style search that `AppShell` is the only
  width-capping wrapper, that `xl:` on the recap rail is the only pre-existing wide-tier responsive
  class in `apps/web/src`, and that no `--breakpoint-*` override exists today (so Task 1's addition
  is net-new, not a conflicting edit).
- **Boundary correctness:** confirmed `apps/web/src/modules/inbox/hooks/use-layout.ts`'s container-
  width-driven split/stacked decision is left untouched; this plan only extends the wide end of the
  spectrum and the shared breakpoint vocabulary, not the mobile/narrow logic.
- **Risk surface:** flagged the `md` 768→800px shift as the one change with the widest blast radius
  (it's a shared-package theme token), and scoped Task 1 to explicitly audit every current `md:`
  consumer before landing, rather than assuming Tailwind/JS realignment is risk-free.
- **Blast radius confirmation (this review pass):** confirmed `@kyomi/ui` is a dependency of
  `apps/web` only — `apps/mobile/package.json` does not depend on it — so the `md`/`3xl`/`4xl`
  breakpoint-token change is contained to the web app; it does not need mobile sign-off.

---

## GSTACK REVIEW REPORT

`/plan-tune` (as literally requested) tunes gstack's own `AskUserQuestion` frequency and developer
psychographic profile — it does not review plan _content_, so it cannot produce the review this
plan needs. This report was produced by applying `/plan-eng-review`'s methodology instead (read from
`~/.claude/skills/gstack/plan-eng-review/{SKILL.md,sections/review-sections.md}`), adapted for a host
without Claude Code's `AskUserQuestion` tool, `codex` CLI, or `~/.gstack` state: findings below are
surfaced in chat for your explicit approval rather than via a per-issue interactive prompt, and the
"Outside Voice" cross-model pass was skipped (no `codex` CLI available in this environment) rather
than silently omitted.

| Review        | Trigger                                                                 | Why                            | Runs | Status                                                  | Findings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------- | ----------------------------------------------------------------------- | ------------------------------ | ---- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eng Review    | `/plan-eng-review` (substituted for the requested `/plan-tune`)         | Architecture & tests           | 1    | CLEAR — issues found and folded into the plan           | 3 findings: (1) two Task 5 assertions described JSDOM-untestable runtime behavior — corrected to class-presence/build-output checks; (2) Task 2's width ladder should be a named constant, matching `GRID_TEMPLATE_COLUMNS`/`APP_SIDEBAR_WIDTH` in the same file — adopted; (3) no visual-regression harness exists in this repo — resolved: logged to `TODOS.md` (decision A)                                                                                                                                                        |
| CEO Review    | —                                                                       | Not requested                  | 0    | —                                                       | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Codex Review  | —                                                                       | Outside-voice cross-model pass | 0    | skipped — `codex` CLI not available in this environment | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Design Review | `make-interfaces-feel-better` + `emil-design-eng` (requested this pass) | UI polish / motion correctness | 1    | CLEAR — 2 findings, both folded into the plan           | 2 findings, both scoped to code this plan already touches: (1) Task 2's shell max-width ladder should explicitly stay un-transitioned (layout-affecting property, fires during continuous window drag-resize) — documented as a deliberate no-animation decision; (2) Task 3's recap rail now appears/disappears on ordinary resize, not just load — added an opacity/scale enter-exit via the existing `@kyomi/ui/motion` + `useReducedMotion()` convention already used on the same page, instead of an abrupt `hidden`/`flex` snap |
| DX Review     | —                                                                       | Not requested                  | 0    | —                                                       | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

**VERDICT:** ENG REVIEW + DESIGN REVIEW findings folded into the plan — CLEARED.

NO UNRESOLVED DECISIONS

---
name: design
description: Shape, implement, critique, audit, or polish Kyomi interfaces across apps/web, apps/mobile, packages/ui, and packages/reader. Use for information architecture, typography, color, layout, responsive reader and inbox behavior, accessibility, component states, icons, motion, gestures, focus treatment, shared design tokens, Tailwind or Uniwind styling, WebView presentation, visual review, and deciding whether presentation belongs in an app, packages/ui, or packages/reader. Pair with web or mobile for implementation and packages for shared-system changes.
---

# Design

Build a coherent reading experience across web and mobile without erasing platform differences.

## Establish context

1. Read `AGENTS.md`, the owning app README, the closest existing surface, and the nearest
   `packages/ui` primitive or `packages/reader` renderer.
2. Load `$web` or `$mobile` for implementation and `$packages` for shared-system changes.
3. Load `$architecture` before changing design ownership or adding a shared primitive used by one
   surface only.
4. Load `$testing` for interaction, accessibility, responsive, and design-system contracts.

## Work through the system

- Start with user intent, content hierarchy, and interaction states before styling.
- Reuse exported components, semantic tokens, icons, motion, and reader entrypoints.
- Keep app-specific composition in the app. Move a primitive to `packages/ui` only when several
  domains or clients need the same responsibility.
- Keep article rendering behavior in `packages/reader`; keep app chrome and product workflows in
  their app domain.
- Use Tailwind utilities for small web layout and typography adjustments. Use Uniwind utilities for
  native surfaces.
- Preserve keyboard, screen-reader, focus, hover, active, disabled, loading, empty, error, success,
  and reduced-motion states as applicable.
- Show form validation per field and only when relevant.
- Keep the app navigation sidebar on the left at every breakpoint. Tablet reader layouts may change
  main-column content, not sidebar placement.
- Use line Mingcute icons by default and filled icons for active persisted state. Give actions
  tooltips where labels are not visible.
- Use `@kyomi/ui/motion` and lazy Motion features. Prefer CSS for simple local state changes and
  Motion for coordinated presence, layout, gesture, or scroll behavior.
- Keep motion purposeful, interruptible when intent can reverse, frequency-aware, and inexpensive.
- Preserve outside-only focus halos without clipping and keep nested control geometry concentric.
- Treat exact values as surface-specific evidence, not universal tokens, until reuse is proven.

## Verify the real surface

1. Check narrow and wide layouts, tablet orientations where relevant, light and dark themes,
   keyboard-only use, reduced motion, long content, empty content, and error states.
2. Inspect console errors, hydration, focus order, hit areas, contrast, layout shift, and animation
   smoothness.
3. Run focused UI tests and the affected app build.
4. Finish through `$qa`.

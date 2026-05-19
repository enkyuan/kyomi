# Icons

Illustrations and branded SVG artwork for product empty states and similar surfaces.

## Adding an icon

1. Add `your-icon-name.tsx` in this folder (kebab-case, one primary export per file).
2. Re-export it from `index.ts`.
3. Import in apps as `@vols.rss/ui/icons/your-icon-name` or from `@vols.rss/ui/icons`.

Keep icons self-contained (props, theme handling, and SVG markup in the same module). Prefer `"use client"` when the icon reads DOM theme or uses effects.

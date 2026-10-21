# @kyomi/ui icons

Product SVG icons and illustrations.

## Adding an icon

1. add a kebab-case `*.tsx` file in this folder.
2. export one React component from it.
3. re-export from `index.ts`.
4. import as `@kyomi/ui/icons/name` or from `@kyomi/ui/icons`.

## Web icons (Blode)

`@kyomi/ui/icons/blode` re-exports the `blode-icons-react` (MIT) icons Kyomi web uses, plus
`IconProps`. Add an icon by exporting it there, preferring the `*Icon` name. Blode icons are stroke
based and Lucide-compatible (`size`, `color`, `strokeWidth`, `absoluteStrokeWidth`). Use the line
icon by default and the `*FilledIcon` variant for a genuinely persisted state (saved, pinned,
active mode). Inside `packages/ui`, components import from `blode-icons-react` directly.

## Native Mingcute data

`@kyomi/ui/icons/mingcute-native` exposes the renderer-neutral path data used by native Kyomi
surfaces (the SwiftUI tab bar and settings rows cannot draw strokes, so they stay on fill glyphs). The paths are copied from `@mingcute/react@1.4.1`, which is distributed under the
Apache-2.0 license. Keep `fillRule` metadata when adding paths so native renderers preserve the
upstream geometry.

Add only icons with a current native consumer. Use line icons by default and add a fill variant only
for a genuinely persisted state.

## Brand marks

`@kyomi/ui/icons/google` owns the multicolor Google G geometry sourced from SVGL. Web renders the
exported SVG component; mobile renders the same path contract through its app-owned React Native
SVG bridge. Do not redraw, recolor, or replace the mark with Mingcute.

## Notes

- Keep SVG markup, props, and theme handling in the same web module.
- Use `"use client"` only when an icon reads DOM state or uses effects.
- Product illustrations belong here. General UI icons come from Blode via `@kyomi/ui/icons/blode`.

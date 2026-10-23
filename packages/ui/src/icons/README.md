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

## Native Blode data

`@kyomi/ui/icons/blode-native` exposes renderer-neutral path data for native Kyomi surfaces (React
Native and the SwiftUI tab bar), so native code never imports the DOM `blode-icons-react`
components. It is generated, not hand-edited: add the icon name to `ICONS` in
`scripts/generate-blode-native.ts` and run `bun run icons:native`. Every path is either a fill path
or a `stroke` path (width `BLODE_STROKE_WIDTH`, no fill); renderers must draw both.

Add only icons with a current native consumer. Use line icons by default and the `*Filled` variant
for a genuinely persisted state.

## Brand marks

`@kyomi/ui/icons/google` owns the multicolor Google G geometry sourced from SVGL. Web renders the
exported SVG component; mobile renders the same path contract through its app-owned React Native
SVG bridge. Do not redraw, recolor, or replace the mark with a Blode icon.

## Notes

- Keep SVG markup, props, and theme handling in the same web module.
- Use `"use client"` only when an icon reads DOM state or uses effects.
- Product illustrations belong here. General UI icons come from Blode via `@kyomi/ui/icons/blode`.

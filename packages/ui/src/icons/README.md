# @kyomi/ui icons

Product SVG icons and illustrations.

## Adding an icon

1. add a kebab-case `*.tsx` file in this folder.
2. export one React component from it.
3. re-export from `index.ts`.
4. import as `@kyomi/ui/icons/name` or from `@kyomi/ui/icons`.

## Native Mingcute data

`@kyomi/ui/icons/mingcute-native` exposes the renderer-neutral path data used by native Kyomi
surfaces. The paths are copied from `@mingcute/react@1.4.1`, which is distributed under the
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
- Product illustrations belong here. General UI icons come from the app's icon library.

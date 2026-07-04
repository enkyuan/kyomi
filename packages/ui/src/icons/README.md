# @kyomi/ui icons

product SVG icons and illustrations.

## adding an icon

1. add a kebab-case `*.tsx` file in this folder.
2. export one React component from it.
3. re-export from `index.ts`.
4. import as `@kyomi/ui/icons/name` or from `@kyomi/ui/icons`.

## notes

- keep SVG markup, props, and theme handling in the same module.
- use `"use client"` only when an icon reads DOM state or uses effects.
- product illustrations belong here. general UI icons come from the app's icon library.

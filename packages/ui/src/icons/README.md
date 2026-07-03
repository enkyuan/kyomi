# @kyomi/ui Icons

Self-contained SVG icons and illustrations for Kyomi product surfaces.

## Add An Icon

1. Add a kebab-case `*.tsx` file in this folder.
2. Export one primary React component from that file.
3. Re-export it from `index.ts`.
4. Import it as `@kyomi/ui/icons/name` or from `@kyomi/ui/icons`.

## Notes

- Keep SVG markup, props, and theme handling in the same module.
- Use `"use client"` only when an icon reads DOM state or uses effects.
- Prefer product-specific illustrations here; general UI icons should come from the app's icon library.

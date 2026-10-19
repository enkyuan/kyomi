# UI package

Use `packages/ui` for reusable presentation primitives and frontend presentation dependencies.

## Structure

The layout follows the shadcn monorepo template and cal.com's `@coss/ui`.

```text
components.json            shadcn CLI config (registry installs land in src/components)
src/
  components/<name>.tsx    Flat primitives, imported as `@kyomi/ui/components/<name>`
  components/<name>/       Multi-file primitive: `index.tsx` plus its parts, hooks, and state
  hooks/use-*.ts           Shared presentation hooks (`@kyomi/ui/hooks/*`)
  icons/                   Kyomi artwork and the Mingcute export (`@kyomi/ui/icons/*`)
  lib/                     Utilities and the Lazy Motion boundary (`@kyomi/ui/lib/motion`)
  native/                  Native-safe theme and motion contracts
  styles/                  `globals.css` entrypoint, `theme.css` tokens, CSS modules
```

Read `packages/ui/README.md` for the token set and primitive conventions.

## Rules

- Reuse existing shadcn/Base UI primitives and tokens before adding another abstraction.
- Keep app-specific compositions in their app. Move a component here only when several domains or
  clients need the same presentation responsibility.
- Export public components and helpers through `@kyomi/ui/*`; do not deep-import source.
- Keep package-local aliases `@hooks/*`, `@icons/*`, `@lib/*`, and `@styles/*` inside this package.
- Keep shared CSS modules in `src/styles` and export them through `@kyomi/ui/styles` subpaths.
- Let each app own its Tailwind or Uniwind entrypoint. Mobile opts into native-compatible modules
  rather than importing the whole web stylesheet.
- Keep frontend presentation dependencies here when apps should not depend on them directly,
  including Mingcute, motion, squircle, and command primitives.
- Export motion through `@kyomi/ui/lib/motion` and keep app imports lazy.
- Express shape, size, and motion through the semantic tokens in `styles/theme.css` (radius ramp,
  control heights, `--ease-*`, `--duration-*`, `--highlight`); avoid arbitrary values in primitives.
- Give interactive primitives keyboard, focus, disabled, loading, error, and reduced-motion states.
- Read `src/icons/README.md` before adding product illustrations.

## Tests and checks

- Put direct primitive contracts under `tests/web/integration/src/packages/ui`.
- Test app-specific composition under the owning web domain.
- Run `bun run --cwd packages/ui typecheck`, `lint`, and `fmt:check`, plus focused web tests and the
  affected app build.

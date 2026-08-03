# UI package

Use `packages/ui` for reusable presentation primitives and frontend presentation dependencies.

## Structure

```text
src/
  <primitive>.tsx          Flat shared primitives
  <complex-area>/          Components, hooks, state, and styles for a cohesive primitive
  hooks/                   Shared presentation hooks
  icons/                   Kyomi artwork and the Mingcute export
  lib/                     Shared presentation utilities
  styles/                  Shared CSS modules and theme entrypoint
  motion.ts                Lazy Motion export boundary
```

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
- Export motion through `@kyomi/ui/motion` and keep app imports lazy.
- Give interactive primitives keyboard, focus, disabled, loading, error, and reduced-motion states.
- Read `src/icons/README.md` before adding product illustrations.

## Tests and checks

- Put direct primitive contracts under `tests/web/integration/src/packages/ui`.
- Test app-specific composition under the owning web domain.
- Run `bun run --cwd packages/ui typecheck`, `lint`, and `fmt:check`, plus focused web tests and the
  affected app build.

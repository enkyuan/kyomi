# TypeScript presets

Use `packages/tsconfig` for shared compiler baselines, not application ownership.

## Presets

- `base.json` owns strict, runtime-neutral TypeScript defaults.
- `web.json` owns browser and React defaults.
- `node.json` owns server and script defaults.

## Rules

- Put a compiler option in a shared preset only when every intended consumer can satisfy it.
- Keep app, package, script, and test aliases in the owning consumer `tsconfig.json`.
- Keep environment-specific global types in the consumer.
- Extend `web.json` for browser or React work and `node.json` for Bun/server work unless a runtime
  has an authoritative framework preset, such as Expo.
- Preserve strictness. Do not weaken a shared preset to silence one consumer.
- Update tests and script configs when a new source or test subtree must be type-checked.
- Keep `packages/tsconfig` free of runtime code and application imports.

Run the affected consumers' typechecks after a preset change; a preset edit is cross-workspace and
must finish through the broader `$qa` matrix.

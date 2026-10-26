# @kyomi/desktop

The Kyomi desktop client. A React tree painted by [GPUIX](https://github.com/remorses/gpuix) (GPUI:
Metal, DirectX, or Vulkan) on Bun. There is no web view and no React Native renderer; the view layer
is `<div>` / `<text>`.

## Layout

```text
src/
  main.tsx   Window entry; ends with render().
  app.tsx    Root component.
```

Shared logic comes from workspace packages (`@kyomi/reader` schemas, document model, and
sanitization). Do not import `@kyomi/reader/web`, `@kyomi/reader/native`, or `@kyomi/ui` components:
they target the DOM and React Native.

## Commands

```bash
bun run --cwd apps/desktop dev        # hot-reloading window
bun run --cwd apps/desktop build      # single binary in dist/
```

`@gpuix/react` and `@gpuix/native` are pinned to the same exact version; upgrade them together.
Give every `<text>` a `color`.

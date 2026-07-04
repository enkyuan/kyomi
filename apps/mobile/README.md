# @kyomi/mobile

the mobile client. built with Expo Router and Uniwind.

## layout

```text
src/
  app/  file-based Expo Router routes and screens.
```

## commands

| command | purpose |
| --- | --- |
| `bun run --cwd apps/mobile start` | start the Expo dev server. |
| `bun run --cwd apps/mobile ios` | build and run on iOS. |
| `bun run --cwd apps/mobile android` | build and run on Android. |
| `bun run --cwd apps/mobile web` | start Expo in web mode. |
| `bun run --cwd apps/mobile typecheck` | type-check. |
| `bun run --cwd apps/mobile lint` | lint. |
| `bun run --cwd apps/mobile fmt:check` | check formatting. |

## notes

- styling uses Uniwind (Tailwind for React Native). global styles live in `src/global.css`.
- native modules run through Nitro (`react-native-nitro-modules`).

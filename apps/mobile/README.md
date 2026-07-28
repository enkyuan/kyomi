# @kyomi/mobile

The Kyomi mobile client. Expo Router composes routes while universal `@expo/ui` delegates native
controls to SwiftUI on iOS and Material 3 Expressive Jetpack Compose on Android.

## Layout

```text
src/
  app/                 Route composition only.
  components/          Narrow React Native bridges, including Mingcute SVG rendering.
  hooks/               Mobile platform and accessibility hooks.
  modules/             Product domains with universal screens and selective platform seams.
```

The inbox has one shared `Host` + `List` screen tree. Its small `row.ios.tsx` and
`row.android.tsx` seams own only native modifiers, animation parameters, and the view-host detail
needed for the Mingcute SVG. Full platform screen forks require a demonstrated API or hierarchy
gap.

## Shared UI boundary

Mobile consumes renderer-neutral contracts through public `@kyomi/ui` subpaths:

- `@kyomi/ui/native/theme` for the proven matcha accent;
- `@kyomi/ui/native/motion` for one-to-one visible effect and reduced-motion semantics;
- `@kyomi/ui/icons/mingcute-native` for Mingcute path geometry.

SwiftUI and Compose own timing, easing, springs, controls, typography, surfaces, accessibility, and
press feedback. Mobile does not import the browser motion wrapper, DOM Mingcute components, CSS,
web fonts, web radii, or web surface palette.

## Commands

| Command                               | Purpose                               |
| ------------------------------------- | ------------------------------------- |
| `bun run --cwd apps/mobile start`     | Start the Expo development server.    |
| `bun run --cwd apps/mobile ios`       | Build and run on iOS.                 |
| `bun run --cwd apps/mobile android`   | Build and run on Android.             |
| `bun run --cwd apps/mobile web`       | Start the web fallback.               |
| `bun run --cwd apps/mobile build`     | Export iOS, Android, and web bundles. |
| `bun run --cwd apps/mobile typecheck` | Type-check the mobile workspace.      |
| `bun run --cwd apps/mobile lint`      | Lint mobile source.                   |
| `bun run --cwd apps/mobile fmt:check` | Check formatting.                     |

## Design rule

Kyomi is quiet at rest and expressive in response. Inbox rows stay contiguous, flat, and
content-led. Android expression comes from ripple, overscroll, typography, tonal response, and
native motion—not resting cards. Mingcute remains bare and unboxed. Matcha is a restrained accent
and low-alpha selected surface.

## Current limits

- The inbox data is a local architecture fixture; auth, networking, persistence, and reader
  rendering are not implemented.
- The fixture is not production-list performance proof. Benchmark representative inbox sizes on
  physical devices before connecting real data.
- `com.anonymous.mobile` is retained on both platforms and must be replaced before distribution.

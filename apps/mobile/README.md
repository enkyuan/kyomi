# @kyomi/mobile

The Kyomi mobile client. Expo Router composes routes while universal `@expo/ui` delegates native
controls to SwiftUI on iOS and Material 3 Expressive Jetpack Compose on Android.

## Layout

```text
src/
  app/                 Route composition only.
  components/          Narrow React Native bridges, including Mingcute SVG rendering.
  hooks/               Mobile platform and accessibility hooks.
  integrations/        Runtime SDK adapters, including the Better Auth provider.
  lib/                 App-wide clients and runtime configuration.
  modules/             Product domains with universal screens and selective platform seams.
```

The inbox has one shared `Host` + `List` screen tree. Its small `row.ios.tsx` and
`row.android.tsx` seams own only native modifiers, animation parameters, and the view-host detail
needed for the Mingcute SVG. Full platform screen forks require a demonstrated API or hierarchy
gap.

Authentication reuses the web app's runtime-neutral contracts through `@kyomi/auth`: field
defaults and validators, safe return targets, session classification, and capability parsing.
Better Auth remains server-authoritative. The native client stores Better Auth's cookie/session
cache in SecureStore and never persists passwords or reset tokens. While the cached session is
being resolved, the native splash screen remains visible; resolution produces only an authenticated
or anonymous route, not a separate error destination.

The anonymous entry route is a native welcome chooser: `Continue with Google` is visible but
disabled, while `Continue with Email` opens the credential route. Credential and recovery flows share
one controller model but use paired renderers:

- SwiftUI `TextField`, `SecureField`, `Button`, and `ProgressView` on iOS;
- Material 3 Expressive `OutlinedTextField`, buttons, and `LoadingIndicator` on Android;
- a React Native fallback for the static web export.

Password reset remains gated by the same `x-kyomi-auth-capabilities` response header as web. Google
OAuth is intentionally unavailable in mobile until its callback and distribution contract are
enabled. The button uses Google's official Super G from `@kyomi/ui/icons/google`, not Mingcute.

Auth follows the same domain-oriented shape as web:

```text
modules/auth/
  components/
    form/
    forgot-password/
    login/
    register/
    reset-password/
    welcome/
  hooks/
  lib/
  index.ts
```

## Shared UI boundary

Mobile consumes renderer-neutral contracts through public `@kyomi/ui` subpaths:

- `@kyomi/ui/native/theme` for the proven matcha accent;
- `@kyomi/ui/native/motion` for one-to-one visible effect and reduced-motion semantics;
- `@kyomi/ui/icons/mingcute-native` for Mingcute path geometry.
- `@kyomi/ui/icons/google` for the official shared Google brand asset.

SwiftUI and Compose own timing, easing, springs, controls, accessibility, and press feedback.
Mobile does not import the browser motion wrapper, DOM Mingcute components, or browser CSS.
Instead, `src/global.css` translates the shared semantic color roles into a native-safe Uniwind
theme. The mobile root loads the same Inter, DM Sans, and JetBrains Mono families as web; React
Native surfaces opt into them through named utilities while SwiftUI and Compose retain native
Dynamic Type and Material typography.

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

## Authentication development

Copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_AUTH_ORIGIN` to the public origin that
serves `/api/auth/*`. The built-in local defaults point at the web auth proxy:

- iOS simulator: `http://localhost:3000`;
- Android emulator: `http://10.0.2.2:3000`.

Run both the API and web app while using those defaults. Use an HTTPS development URL and an Expo
development build for stable password-reset callbacks. Expo Go's callback URL is not a stable
application identity. Release builds reject a non-HTTPS authentication origin.

## Design rule

Kyomi is quiet at rest and expressive in response. Inbox rows stay contiguous, flat, and
content-led. Android expression comes from ripple, overscroll, typography, tonal response, and
native motion—not resting cards. Mingcute remains bare and unboxed. Matcha is a restrained accent
and low-alpha selected surface.

## Current limits

- The inbox `All` list and pinned folders use the authenticated API. Per-feed inbox views,
  persistence, and reader rendering remain local architecture fixtures.
- The fixture is not production-list performance proof. Benchmark representative inbox sizes on
  physical devices before connecting real data.
- Replace the development `kyomi://` auth callback with verified Universal Links and Android App
  Links before distribution so another installed app cannot claim password-reset or OAuth
  callbacks.
- `com.anonymous.mobile` is retained on both platforms and must be replaced before distribution.

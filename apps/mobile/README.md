# @kyomi/mobile

The Kyomi mobile client. Expo Router composes routes while universal `@expo/ui` delegates native
controls to SwiftUI on iOS and Material 3 Expressive Jetpack Compose on Android.

## Layout

```text
src/
  app/                 Route composition only.
  components/          Narrow React Native bridges, including Blode SVG rendering.
  hooks/               Mobile platform and accessibility hooks.
  integrations/        Runtime SDK adapters, including the Better Auth provider.
  lib/                 App-wide clients and runtime configuration.
  modules/             Product domains with universal screens and selective platform seams.
```

Inbox and Recents share query, filtering, and row-formatting logic. iOS renders articles through
the local `article-list` Expo module, using a UIKit collection view with SwiftUI rows. Android and
the web fallback use Legend List with React Native rows. The list contracts are described below.

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
enabled. The button uses Google's official Super G from `@kyomi/ui/icons/google`, not a Blode icon.

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
- `@kyomi/ui/icons/blode-native` for generated Blode path geometry (fill and stroke paths).
- `@kyomi/ui/icons/google` for the official shared Google brand asset.

SwiftUI and Compose own timing, easing, springs, controls, accessibility, and press feedback.
Mobile does not import the browser motion wrapper, DOM Blode components, or browser CSS.
Instead, `src/global.css` translates the shared semantic color roles into a native-safe Uniwind
theme. The mobile root loads the same Inter, DM Sans, and JetBrains Mono families as web; React
Native surfaces opt into them through named utilities while SwiftUI and Compose retain native
Dynamic Type and Material typography.

## Commands

| Command                                | Purpose                                 |
| -------------------------------------- | --------------------------------------- |
| `bun run --cwd apps/mobile start`      | Start the Expo development server.      |
| `bun run --cwd apps/mobile ios`        | Build and run on iOS.                   |
| `bun run --cwd apps/mobile ios:device` | Build and run on a physical iOS device. |
| `bun run --cwd apps/mobile android`    | Build and run on Android.               |
| `bun run --cwd apps/mobile web`        | Start the web fallback.                 |
| `bun run --cwd apps/mobile build`      | Export iOS, Android, and web bundles.   |
| `bun run --cwd apps/mobile typecheck`  | Type-check the mobile workspace.        |
| `bun run --cwd apps/mobile lint`       | Lint mobile source.                     |
| `bun run --cwd apps/mobile fmt:check`  | Check formatting.                       |

## Authentication development

Run Tailscale on the Mac and the iPhone. `start` and `ios:device` then advertise Metro on the
Mac's Tailscale address (`scripts/expo.sh`), a stable private address that works on any network,
including ones that isolate Wi-Fi clients and refuse phone-to-Mac connections. Without Tailscale
they fall back to the LAN address. Set `REACT_NATIVE_PACKAGER_HOSTNAME` to override.

Dev builds derive the API origin at runtime from the host that served the JS bundle (Metro's
`hostUri`), on port 8000. If the phone can load the app from Metro, it can reach the API on the
same host, on any network and across DHCP changes; no address is baked into the build. Run
`bun run --cwd apps/mobile start` and keep it running: `ios:device` only builds and installs, and
a Debug build loads its JS from Metro.

`EXPO_PUBLIC_AUTH_ORIGIN` (shell or encrypted `apps/mobile/.env.local`) overrides the derived
origin. Tunnel hosts cannot reach the API port, so tunnel mode needs it set. Release builds embed
the API origin at build time and run without Metro. Simulators fall back to `localhost` (iOS) and
`10.0.2.2` (Android emulator).

Restart Metro after changing the value. The API already listens on all interfaces by default, and
Docker publishes only the API port to the host network; Postgres, Redis, Garage, and Meilisearch
remain bound to loopback. On the iPhone, enable Kyomi under Settings → Privacy & Security → Local
Network if iOS asks for permission.

### Any-network development (tunnel mode)

Shared networks (campus, office, hotel) commonly block device-to-device traffic, which breaks the
LAN defaults above for both Metro and the API. Tunnel both hops instead:

1. Start Metro with `bun run --cwd apps/mobile start:tunnel` (no `REACT_NATIVE_PACKAGER_HOSTNAME`
   override, so the Expo tunnel is used) and open the QR code or printed `exp+kyomi://` URL in the
   installed development build. Works on any Wi-Fi or cellular.
2. Expose the API through a tunnel with a **stable** origin so `EXPO_PUBLIC_AUTH_ORIGIN` is set
   once and never requires a rebuild per network:
   - Tailscale on the Mac and iPhone, then use the Mac's tailnet IP:
     `bun run dotenvx set EXPO_PUBLIC_AUTH_ORIGIN "http://$(tailscale ip -4):8000" -f apps/mobile/.env.local -fk apps/mobile/.env.keys`;
   - or a static-domain ngrok endpoint (`ngrok http 8000 --domain=<your-domain>.ngrok-free.app`).
3. Rebuild the development build once after changing `.env.local` — `EXPO_PUBLIC_*` values are inlined at
   bundle time.

Run the API while using those defaults. Use an HTTPS development URL and an Expo development build
for stable password-reset callbacks. Expo Go's callback URL is not a stable application identity.
Release builds reject a non-HTTPS authentication origin.

## Design rule

Kyomi is quiet at rest and expressive in response. Inbox rows stay contiguous, flat, and
content-led. Android expression comes from ripple, overscroll, typography, tonal response, and
native motion—not resting cards. Blode icons remain bare and unboxed. Matcha is a restrained accent
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

## Article lists

Inbox and Recents render with Legend List on every platform. Article queries, filters, actions, and
row formatting live in TypeScript under `src/modules/articles` and `src/modules/inbox`.

`modules/article-list` is a parked iOS Expo module: a UIKit collection view with reusable SwiftUI
article rows. No screen mounts it (the wiring was reverted in #133), and its unused TypeScript-side
helpers (`useNativeListSync`, row and style mapping) have been removed; recover them from git
history (for example commit `748072be`) if the list returns. Profile representative inbox sizes on
a device before re-landing it.

Use `bun run --cwd tests test:mobile` for the mobile contracts. On macOS this also compiles and
executes the parked module's Foundation-only Swift row models, reducer, and asynchronous pipeline; other platforms skip that test.
The SwiftUI/Expo bridge still requires an iOS development build. Instruments points of interest in
`ArticleListSignpost` distinguish decoding/reduction, snapshot application, and cell configuration.
These counters are measurement hooks, not evidence of a frame-rate improvement by themselves.

Implementation references (accessed 2026-10-24):
[Expo view functions and lifecycle](https://docs.expo.dev/modules/module-api/),
[Apple collection-view performance](https://developer.apple.com/videos/play/wwdc2021/10252/), and
[SwiftUI fonts relative to text styles](<https://developer.apple.com/documentation/swiftui/font/custom(_:size:relativeto:)>).
The bridge was checked against ExpoModulesCore 57.0.24, and native compilation uses Xcode 27.1.
The explicit `.runOnQueue(.main)` follows the installed API rather than relying on documentation's
default-queue statement. A native development build is required after these changes.

## Reader renderers and baseline measurement

The reader has two body renderers. The native KDM renderer (`@kyomi/reader/native`, wired in
`modules/reader/components/native-article-body.tsx`) is the default on iOS; the DOM WebView reader
(`article-body.dom.tsx`) is the default elsewhere. Native is chosen only when **all** hold: the build is
iOS and `EXPO_PUBLIC_KYOMI_NATIVE_READER` is not `0` at build time, the article carries
a document body, its `version` is one `isSupportedDocumentVersion` accepts, and it passes
`readerDocumentSchema`. Anything else falls back to the DOM body. The request header that announces the
supported version and the `bodyKind: "document"` member of `reader.selected` follow the approved API contract and live in `src/lib/reader-document.ts`
(`documentVersion` must be 1..`READER_DOCUMENT_VERSION`; the parse runs once per fetched article).

Link taps open `expo-web-browser`; long-pressing a link shares it. Images go through the reader image
proxy via `expo-image` (thumbhash placeholders, zero transition under reduce motion); tapping opens the
viewer. Footnote refs open a page-sheet modal. `html` blocks, math and unsnapshotted players render in
`html-island.dom.tsx` (one DOM component each; players mount only after a tap). Scroll position restores
from the server reading position when "Remember reading position" is on (the same
`initialProgress` and `onReadingProgress` as the DOM body), and otherwise from the first visible row
index (`reader-position` MMKV store). The article is validated against `articleDetailSchema` on fetch.

### Measure DOM vs. native on a device

1. Build a development build (`bun run ios:device`) with
   `EXPO_PUBLIC_KYOMI_READER_METRICS=1 EXPO_PUBLIC_KYOMI_READER_FIXTURE=long`. The fixture swaps any
   opened article for a 400-paragraph article, rendered as HTML (DOM) and as KDM (native) so both
   show identical content. Native is the default on iOS; set `EXPO_PUBLIC_KYOMI_NATIVE_READER=0` for the DOM run.
2. Open the article and read the `[reader-metrics]` console line (Metro log): `renderer`,
   `timeToFirstContentMs` (article data available → first content laid out; for the DOM path this is
   the first animation frame after React mounted in the WebView, so it understates WebView paint),
   and `hermesHeapBefore/After` when Hermes exposes them. Repeat 5 times cold and 5 warm; compare medians.
3. Memory: the WebView's memory is outside Hermes. In Xcode, Debug Navigator → Memory (or Instruments →
   Allocations/VM Tracker) after fully scrolling the fixture; note the app total plus the
   `com.apple.WebKit.WebContent` process for DOM. On Android use Android Studio Profiler → Memory.
4. Scroll smoothness: Instruments → Core Animation / Hitches while flinging the fixture end to end.

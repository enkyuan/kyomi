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

| Command                               | Purpose                               |
| ------------------------------------- | ------------------------------------- |
| `bun run --cwd apps/mobile start`     | Start the Expo development server.    |
| `bun run --cwd apps/mobile ios`       | Build and run on iOS.                 |
| `bun run --cwd apps/mobile ios:device` | Build and run on a physical iOS device. |
| `bun run --cwd apps/mobile android`   | Build and run on Android.             |
| `bun run --cwd apps/mobile web`       | Start the web fallback.               |
| `bun run --cwd apps/mobile build`     | Export iOS, Android, and web bundles. |
| `bun run --cwd apps/mobile typecheck` | Type-check the mobile workspace.      |
| `bun run --cwd apps/mobile lint`      | Lint mobile source.                   |
| `bun run --cwd apps/mobile fmt:check` | Check formatting.                     |

## Authentication development

`EXPO_PUBLIC_AUTH_ORIGIN` is optional for local development. Create `.env.local` only to override
the public origin serving `/api/auth/*`. The built-in local defaults point directly to the API:

- iOS simulator: `http://localhost:8000`;
- Android emulator: `http://10.0.2.2:8000`;
- physical iPhone: `http://<Mac-LAN-IP>:8000`, configured through `.env.local`.

For a physical iPhone on the same Wi-Fi network, get the Mac's address with
`ipconfig getifaddr en0`, then store the override in an encrypted mobile env file:

```sh
LAN_IP="$(ipconfig getifaddr en0)"
bun run dotenvx set EXPO_PUBLIC_AUTH_ORIGIN "http://${LAN_IP}:8000" \\
  -f apps/mobile/.env.local -fk apps/mobile/.env.keys
```

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

On iOS, `modules/article-list` hosts a UIKit collection view with reusable SwiftUI article rows.
Android and the web fallback use Legend List. Article queries, filters, actions, and row formatting
remain in TypeScript under `src/modules/articles` and `src/modules/inbox`.

- `useNativeListSync` serializes incremental row operations and paging together, coalesces pending
  state, and retries one failed delivery with a full reset. A scope/filter change resets to the top.
- Native updates preserve the first surviving visible article and its offset. Content-only edits
  reconfigure the existing snapshot; insertions, removals, and reorderings update its identifiers.
- Pull to refresh uses the query's refetch state on every renderer, including empty lists. A page
  hidden entirely by a local filter advances to the next page until an article appears, the server
  is exhausted, or a request fails. Empty-page errors wait for an explicit refresh; populated native
  lists retry failed paging on the next drag.
- The native handle offers `scrollToItem(id, animated)` and `scrollToOffset(offset, animated)`.
  `onVisibleItemsChange` reports visible IDs in display order only when that set changes. Ordinary
  header/tab-bar scroll effects stay on the Reanimated UI thread.
- Native favicons share decoded thumbnails and in-flight requests. Failed URLs expire after 30
  seconds; changing a row's favicon URLs resets its image identity.

The native list is a vertical article/Recents renderer, not a general Legend List replacement.
There are no current consumers for grids, horizontal lists, sticky sections, or chat/end anchoring.
The inbox does not currently supply a list header; its collapsing header is a separate overlay.

Use `bun run --cwd tests test:mobile` for the TypeScript contracts. On macOS this also compiles and
executes the production Foundation-only Swift row models, reducer, and asynchronous pipeline; other platforms skip that test.
The SwiftUI/Expo bridge still requires an iOS development build. Instruments points of interest in
`ArticleListSignpost` distinguish decoding/reduction, snapshot application, and cell configuration.
These counters are measurement hooks, not evidence of a frame-rate improvement by themselves.

Implementation references (accessed 2026-10-24):
[Expo view functions and lifecycle](https://docs.expo.dev/modules/module-api/),
[Apple collection-view performance](https://developer.apple.com/videos/play/wwdc2021/10252/), and
[SwiftUI fonts relative to text styles](https://developer.apple.com/documentation/swiftui/font/custom(_:size:relativeto:)).
The bridge was checked against ExpoModulesCore 57.0.24, and native compilation uses Xcode 27.1.
The explicit `.runOnQueue(.main)` follows the installed API rather than relying on documentation's
default-queue statement. A native development build is required after these changes.

## Reader renderers and baseline measurement

The reader has two body renderers. The DOM WebView reader (`article-body.dom.tsx`) is the default. The
native KDM renderer (`@kyomi/reader/native`, wired in `modules/reader/components/native-article-body.tsx`)
is chosen only when **all** hold: `EXPO_PUBLIC_KYOMI_NATIVE_READER=1` at build time, the article carries
a document body, its `version` is one `isSupportedDocumentVersion` accepts, and it passes
`readerDocumentSchema`. Anything else falls back to the DOM body. The request header that announces the
supported version and the document field name are placeholders confined to `src/lib/reader-document.ts`
until the storage/API contract is final.

Link taps open `expo-web-browser`; long-pressing a link shares it. Images go through the reader image
proxy via `expo-image` (thumbhash placeholders, zero transition under reduce motion); tapping opens the
viewer. Footnote refs open a page-sheet modal. `html` blocks, math and unsnapshotted players render in
`html-island.dom.tsx` (one DOM component each; players mount only after a tap). Scroll position restores
from the first visible row index (`reader-position` MMKV store).

### Measure DOM vs. native on a device

1. Build a development build (`bun run ios:device`) with
   `EXPO_PUBLIC_KYOMI_READER_METRICS=1 EXPO_PUBLIC_KYOMI_READER_FIXTURE=long`. The fixture swaps any
   opened article for a 400-paragraph article, rendered as HTML (DOM) and as KDM (native) so both
   show identical content. Add `EXPO_PUBLIC_KYOMI_NATIVE_READER=1` for the native run.
2. Open the article and read the `[reader-metrics]` console line (Metro log): `renderer`,
   `timeToFirstContentMs` (article data available → first content laid out; for the DOM path this is
   the first animation frame after React mounted in the WebView, so it understates WebView paint),
   and `hermesHeapBefore/After` when Hermes exposes them. Repeat 5 times cold and 5 warm; compare medians.
3. Memory: the WebView's memory is outside Hermes. In Xcode, Debug Navigator → Memory (or Instruments →
   Allocations/VM Tracker) after fully scrolling the fixture; note the app total plus the
   `com.apple.WebKit.WebContent` process for DOM. On Android use Android Studio Profiler → Memory.
4. Scroll smoothness: Instruments → Core Animation / Hitches while flinging the fixture end to end.

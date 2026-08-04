# toast

Natively-rendered toasts drawn on an **overlay above the app** — SwiftUI on iOS
(adaptive Liquid Glass), Jetpack Compose on Android (opaque adaptive surface).
Springy entrance, per-position vertical stacking, async loading toasts. No React
context or portal: the whole API is a module-level object. Mount
`<ToastViewport />` once beside the tab navigator to keep the native overlay
clear of the top tabs and floating tab bar.

A port of the [`liquid_toasts`](https://github.com/rehmatsg/liquid-toasts) Flutter
plugin. The native rendering layers are the same Swift/Kotlin sources; only the
bridge (Flutter method/event channels → Expo Modules API) and the caller-facing
layer (Dart → TypeScript) were rewritten.

## Usage

```ts
import { toast } from "@ui/toast";

// Semantic one-liners — fire and forget, no await, no context
toast.success("Saved to favorites");
toast.error("Could not connect");
toast.warning("Low storage");
toast.info("3 updates available");
toast.show("Plain message");
```

### Action button

```ts
toast.warning("Low storage", {
  duration: null, // persistent until tapped/dismissed
  action: { label: "Manage", role: "primary", onPressed: openStorageSettings },
});
```

### Wrap a promise (the call returns your result)

```ts
const user = await toast.promise(api.signIn(email, password), {
  loading: "Signing in…",
  success: (u) => `Welcome back, ${u.firstName}!`,
  error: "Sign-in failed",
});
// `user` is your value; on failure the call rethrows so your try/catch fires.
```

`loading` takes a string or a `Toast`; `success` / `error` take a string, a
`Toast`, or a builder over the settled value. An invalid spec throws immediately,
at the call site — not after the promise settles.

### Persistent toast + live handle

```ts
const t = toast.loading("Connecting…"); // handle returned synchronously
await delay(2000);
void t.update({ loading: false, message: "Connected", semantic: "success" });
void t.dismiss();
const reason = await t.onDismissed; // always resolves
```

`update` patches only the fields you pass (rapid patches compose, in order);
`replace(toast)` swaps the content wholesale, which is how you clear an optional
field.

### Positioning, replace-by-key, progress

```ts
toast.show("Copied link", { icon: "link", position: "bottomCenter" });

// Replace-or-update instead of stacking duplicates
toast.info("Reconnecting…", { groupKey: "net", duration: null });

// Determinate progress via patch updates
const t = toast.show("Uploading…", { duration: null, progress: 0 });
void t.update({ progress: 0.6 });
void t.update({ progress: 1, message: "Uploaded", duration: 2000 });
```

### Custom colors

```ts
import { hexColor, toast } from "@ui/toast";

// `background` colors the surface; iOS 26+ tints the glass, elsewhere it fills.
// Leave `foreground` unset and a readable text color is derived by WCAG contrast.
toast.show("Copied", { style: { background: hexColor("#b0afb0") } });
toast.show("Saved to Library", {
  style: { background: hexColor("#2196F3", "#0D47A1") }, // light, dark
});
```

`tint` colors the accent (icon / spinner / progress ring); `background` the
surface; `foreground` overrides the auto-derived text color.

### App-wide defaults

```ts
await toast.setDefaults({
  defaultPosition: "topCenter",
  maxLines: 3, // messages (per-toast maxLines still wins)
  titleMaxLines: 2, // titles (per-toast titleMaxLines still wins)
  safeArea: { top: 96, bottom: 72 },
  maxVisible: 3,
});
```

`defaultDuration` left unset keeps the per-semantic defaults (success/info/warning
3s, error 4s). `safeArea` is a **minimum** inset in logical pixels — the native
overlays always respect the real device safe area too, taking the larger value per
edge, so you can reserve space for headers or bottom navigation without
double-counting the status bar or home indicator.

## Duration semantics

`duration` is in **milliseconds**, and the three states are distinct:

| Value         | Meaning                                              |
| ------------- | ---------------------------------------------------- |
| omitted       | use `defaultDuration`, else the per-semantic default |
| `null` or `0` | persistent — requires explicit dismissal             |
| a number      | that many milliseconds                               |

## API

| Export                                          | Purpose                                                                                                                                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `toast`                                         | `show` · `success/error/warning/info/loading` · `raw` · `promise` · `dismiss/dismissAll` · `setDefaults` · `queryGeometry` · `activeCount/activeIds` — every show returns a handle synchronously |
| `Toast`                                         | Immutable content (message, title, SF Symbol icon, semantic, style, position, duration, action, progress, haptic, …)                                                                             |
| `ToastAction`                                   | Single action button (`label`, `onPressed`, `role`, `color`, `dismissOnPress`, `loadingOnPress`)                                                                                                 |
| `ToastHandle`                                   | Live controller: `update` (patch), `replace`, `dismiss`, `onDismissed`                                                                                                                           |
| `ToastStyleOverride` / `hexColor` / `argbColor` | Per-toast `background` / `tint` / `foreground` / `iconColor` / `glass` / `cornerRadius` / `symbolEffect` (adaptive light/dark)                                                                   |
| `ToastConfig`                                   | App-wide position/duration, line limits, minimum safe area, stack limits                                                                                                                         |

## Platform support

The API, wire protocol, and behavior are identical on both platforms — positions,
stacking, semantics, actions (incl. async), `promise` morphs, progress,
replace-by-key, tap/swipe-to-dismiss, wall-clock auto-dismiss (which survives
backgrounding), haptics, and accessibility. Only the native surface differs:

|                       | iOS                                                        | Android                                            |
| --------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| Renderer              | SwiftUI overlay (same window)                              | Compose overlay (decor view)                       |
| Surface               | Liquid Glass (26+) / `.ultraThinMaterial` (17–25) / opaque | Opaque adaptive surface                            |
| Icons                 | SF Symbols + animated symbol effects                       | SF Symbol names mapped to Material glyphs (static) |
| Dynamic Island origin | Yes (top-center)                                           | — (slide-in)                                       |
| Min version           | iOS 17.0                                                   | Android 7.0 (API 24)                               |

**Web** has no native overlay. The binding falls back to a no-op stub so shared
code stays importable and every handle still resolves; toasts are simply not
rendered there.

## Requiring a native build

This is a native module, so it needs a dev build — **it will not work in Expo Go**:

```bash
bun run --cwd apps/mobile ios
```

Native code changes are not picked up by Fast Refresh; rebuild after editing
anything under `apps/mobile/modules/liquid-toasts/{ios,android}`.

## Source layout

```text
toast/
  index.ts                 # public API only
  components/
    viewport.tsx           # mounted React boundary for chrome clearance
  lib/
    config.ts              # presentation defaults and bridge config
    ids.ts                 # session-scoped toast and action identifiers
    manager.ts             # lifecycle, event subscription, and FIFO operations
    model.ts               # caller model and wire serialization
    style.ts               # color/style serialization
    types.ts               # shared wire enums and event types
```

The native Expo module intentionally remains separate at
`apps/mobile/modules/liquid-toasts/`; it is an implementation dependency of the
toast manager, not a React Native UI component.

## Architecture

Two layers, mirroring the original plugin:

- **`lib/manager.ts`** owns all caller-facing state: the registry (toast id →
  dismissal deferred, action callback + `activeActionId`, `onTap`, `lastToast`,
  generation counter, per-toast op chain), the event subscription, the memoized
  handshake, and the config. Every platform operation for a toast runs on its
  registration's **FIFO op chain**, which is what lets `show` return a handle
  synchronously — an `update`/`dismiss` issued before the show acks just queues
  behind it. Op errors never escape to fire-and-forget callers (a failed show
  resolves the handle `channelLost`). `dismissAll` chases in-flight shows with an
  idempotent per-id dismiss so no native toast is orphaned.
  **All user callbacks live here and never cross the bridge** — native only echoes
  back ids, so a stale tap after an `update` swapped the action is dropped by
  comparing `activeActionId`; a replace/patch bumps the registration `generation`,
  which supersedes any in-flight `loadingOnPress` completion.
- **`components/viewport.tsx`** is the mounted React boundary. It sends the top-tab and
  floating-tab-bar edges to the native manager as minimum safe-area geometry;
  the SwiftUI and Compose containers retain ownership of their final optical
  gap, system insets, keyboard avoidance, and rendering.
- **`modules/liquid-toasts/{ios,android}`** owns all rendering and the actual
  toast stack. `ToastManager` is the single source of truth for the stack;
  `DeadlineScheduler` owns every auto-dismiss deadline as **wall-clock** time, so
  timers survive backgrounding. `ToastMetrics` holds every shared layout constant
  and spring — change layout numbers there, since the off-screen measurement
  probes must mirror the live layout's insets exactly.

### Wire protocol invariants

When changing anything that crosses the bridge, keep all three sides in lockstep:

- **Enum/event strings are identical on every side** by exact string match
  (dismiss reasons `timeout`/`manual`/`swipe`/`action`/`tap`/`replaced`/
  `dismissAll`/`appBackgrounded`; events `shown`/`actionTapped`/`tapped`/
  `dismissed`). `lib/types.ts` maps them on the JS side.
- **Ids are minted in JS** (`lib/ids.ts`): `lt_<sessionPrefix>_<counter>`. The
  prefix is random per JS context and sent in `handshake`. Native `flushAll`s
  **unconditionally on every handshake**, which is what clears stale toasts after
  a fast-refresh (the old JS listener is dead, so those toasts must be dropped
  silently).
- Command acks are maps: `show`→`{accepted}`, `update`→`{applied}`,
  `dismiss`→`{dismissed}`, `dismissAll`→`{dismissedIds}`. A `false`/missing ack is
  an expected race (toast already gone) — the engine reconciles by locally
  resolving the handle so `onDismissed` never hangs.
- The leading image crosses as **base64** (JS has no byte-array bridge type) and
  is decoded off the main thread natively.

## Tests

```bash
bun run test:mobile
```

`tests/mobile/integration/toast/manager.test.ts` pins the behaviors native can't
enforce: per-toast FIFO op ordering, stale action-tap rejection, the generation
guard on async actions, promise value/throw passthrough, `dismissAll`
reconciliation, and duration/line-limit precedence. It mocks the native module,
so it runs without a device.

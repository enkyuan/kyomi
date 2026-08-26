# Kyomi Mobile Native UI Foundation Implementation Plan

> **For agentic workers:** Use `subagent-driven-development` when parallel tasks do not touch the
> same files. Advance the existing checkboxes in order. Preserve unrelated GitButler work and stop
> if dependency-owned lockfile changes cannot be isolated.

**Goal:** Upgrade `apps/mobile` to the latest Expo SDK 57-compatible dependency set and establish a
small, production-shaped Kyomi mobile foundation. One React tree must delegate to SwiftUI on iOS
and Material 3 Expressive Jetpack Compose on Android while reusing only renderer-neutral Kyomi
contracts from `packages/ui`.

**Architecture:** Expo Router owns navigation and route composition. The inbox screen uses the
universal root exports from `@expo/ui`, which delegate controls and layout to SwiftUI or Compose.
Platform files are selective seams for native animation parameters and React Native view hosting;
they do not duplicate screen hierarchy. `packages/ui` shares the matcha brand accent, one
renderer-neutral Mingcute RSS path, and exact motion-effect semantics. SwiftUI and Compose retain
their own curves, physics, press feedback, typography, accessibility, and system surfaces.

**Design posture:** Quiet at rest, expressive in response. Kyomi's web and mobile products share a
restrained, list-first product language rather than identical pixels. The resting inbox is flat and
content-led. Native identity appears through navigation, controls, press/ripple feedback,
overscroll, accessibility, and platform motion—not through decorative cardification.

**Tech stack:** Expo SDK 57, React 19.2, React Native 0.86, Expo Router, universal `@expo/ui`,
SwiftUI, Material 3 Expressive Jetpack Compose, `react-native-svg`, Bun, TypeScript, Vitest, Expo
Prebuild, and GitButler.

## Product and design decisions

The prior Office Hours choices are resolved as follows:

- Builder mode is open-source/research + learning + fun. This checkpoint should demonstrate the
  architecture clearly without pretending a static fixture is production inbox integration.
- Use universal `@expo/ui` first. Introduce an iOS or Android component fork only when the installed
  SDK's public types or live behavior demonstrate a real gap.
- Preserve a strong platform identity and strong Kyomi parity at the same time:
  - **Shared:** information hierarchy, matcha accent, Mingcute geometry, motion intent, visible
    effect category, reduced-motion result, empty/loading/error vocabulary when those states land.
  - **Platform-owned:** navigation chrome, controls, system typography, semantic surfaces, press
    feedback, overscroll, animation timing, easing, springs, accessibility behavior.
- Mingcute remains the icon language. Do not map icon names to SF Symbols or Material Symbols.
- Animation **types and visible outcomes are one-to-one**. Their native curve/physics values are
  deliberately not one-to-one.
- The first scaffold renders representative local articles only. Auth, networking, persistence,
  real inbox data, reader rendering, and production list performance are later checkpoints.

## Global constraints

- Upgrade by running `bunx expo install expo@latest`, followed by `bunx expo install --fix`.
  Do not hand-select React Native, React, or Expo-governed patch versions.
- Keep `apps/mobile/src/app` route-only. Domain UI belongs under `apps/mobile/src/modules`.
- Use the universal root `@expo/ui` exports in the shared screen. Imports from
  `@expo/ui/swift-ui` or `@expo/ui/jetpack-compose` are allowed only in narrow platform seams.
- Do not add a custom Expo native module unless the post-upgrade public API cannot express a
  required behavior and the gap is documented.
- Import shared code only through public `@kyomi/*` exports. Remove aliases that point directly at
  `packages/ui/src`.
- Do not import the browser `@kyomi/ui/motion`, DOM Mingcute React components, CSS, web fonts,
  web radii, or web surface palette into the native graph.
- Share Mingcute path data, not a web React component. Render it with `react-native-svg` inside the
  narrow React Native host boundary required by `@expo/ui`.
- Initial renderer-neutral package scope is deliberately small:
  - matcha accent only;
  - `rss-2-line` only;
  - `selection-change` motion intent only.
    Add mizu, additional icons, or additional motion intents only with a real consumer.
- A motion contract owns the visible selection-surface outcome and reduced-motion outcome. It owns
  no duration, easing, damping, stiffness, or platform animation object.
- The resting inbox must be one contiguous list:
  - no per-row gaps, outlines, shadows, elevation, oversized radii, or asymmetric resting shapes;
  - no permanently scaled, dimmed, or translated unselected rows;
  - matcha is a restrained accent or low-alpha selected surface, never a full-strength row fill or
    green outline;
  - Android Expressive appears through ripple, overscroll, native typography, tonal response, and
    motion—not cards;
  - Mingcute icons are bare and unboxed; line icons are the default;
  - visible hierarchy is source → title → summary, with a compact timestamp where useful;
  - system typography and semantic native surfaces are mandatory.
- The Mingcute RSS icon is decorative when the source is also visible. A row is one accessible
  target, avoiding duplicate VoiceOver/TalkBack stops.
- Reduce Motion changes the selection surface immediately; it does not leave a zero-duration
  spatial transform.
- Keep `com.anonymous.mobile` as an explicit release blocker rather than inventing store
  identifiers.
- Do not add auth, API synchronization, MMKV, Nitro, reader WebView rendering, tabs,
  notifications, distribution configuration, or a new mobile test runner.
- Treat the fixture and per-row React Native icon host as architecture proof, not production
  throughput proof. Benchmark representative inbox counts on physical devices before real data.
- Preserve unrelated work. Do not edit `.superpowers/sdd/*`, unrelated web files, or existing
  package/UI changes owned by other GitButler branches.
- Do not push or open a pull request.

## Confirmed repository and platform facts

- `apps/mobile` is currently the Expo/Uniwind welcome template with generated iOS and Android
  projects.
- The pre-upgrade app resolves Expo 56, React Native 0.85, Expo Router 56, and `@expo/ui` 56.
- Uniwind, MMKV, and Nitro packages have no meaningful mobile consumer in the current scaffold.
- The mobile TypeScript config bypasses the package export map with a direct source alias; this
  must be removed.
- `packages/ui` owns the presentation system, but its existing icon and motion entrypoints are
  browser/DOM-specific. Native code needs separate pure-TypeScript subpaths.
- Universal `@expo/ui` exposes a single Host/List/ListItem surface that delegates to SwiftUI or
  Compose. Its Android host uses the Material Expressive theme.
- Raw React Native leading accessories may require different native host placement on iOS and
  Android. Confirm this against the installed SDK 57 declarations before choosing the seam.
- Root typechecking already includes the mobile workspace. Boundary scanning does not yet include
  `apps/mobile/src`, and the root build has no durable mobile bundle because mobile has no `build`
  script.
- `bun.lock` already contains unrelated dependency work and is also touched by another applied
  branch. It cannot be treated as an uncontested whole-file change.

## Target ownership and dependency direction

```text
packages/ui
  src/native/theme.ts
    └─ matcha values only; no React, DOM, CSS, or native runtime import
  src/native/motion.ts
    └─ intent → exact normal/reduced visual outcome; no timing or physics
  src/icons/mingcute-native.ts
    └─ renderer-neutral 24×24 RSS path objects with fill-rule support

apps/mobile
  src/app/
    └─ Expo Router route composition only
  src/components/mingcute-icon.tsx
    └─ react-native-svg renderer consuming @kyomi/ui path data
  src/hooks/use-reduced-motion.ts
    └─ AccessibilityInfo subscription
  src/modules/inbox/
    ├─ model.ts
    ├─ screen.tsx
    ├─ row.tsx
    ├─ row.ios.tsx
    └─ row.android.tsx

screen.tsx
  └─ one universal Host + List tree
       └─ row.<platform>.tsx
            ├─ consumes the same row props and resolved visual effect
            ├─ owns native timing/physics only
            └─ hosts the same Mingcute geometry
```

Dependency direction:

```text
apps/mobile → @kyomi/ui/native/*
apps/mobile → @kyomi/ui/icons/mingcute-native
packages/ui native contracts → no app, React, DOM, CSS, or native runtime
```

Rejected:

- full `screen.ios.tsx` and `screen.android.tsx` copies;
- shared web/native React primitives;
- SF Symbol or Material Symbol mapping;
- shared duration/spring constants;
- custom Swift/Kotlin module for behavior already available through `@expo/ui`;
- an icon catalog or native theme surface broader than the scaffold consumes.

## Visual acceptance contract

The scaffold is acceptable only when all of the following are true on both platforms:

1. The inbox reads as a single content list, not a card collection.
2. Ordinary rows rest on the native semantic surface with only subtle native separation.
3. Selection uses a low-alpha matcha surface and does not reshape the row.
4. Android retains Material 3 Expressive ripple, overscroll, typography, tonal response, and
   native motion without decorative Expressive shapes at rest.
5. iOS retains native navigation, list behavior, system typography, press feedback, and native
   motion without copying the web background or radii.
6. The same source, title, summary, timestamp, and RSS icon are present in the same hierarchy.
7. The RSS icon is an unboxed Mingcute line icon and not a separate accessibility stop.
8. Long sources, two-line titles/summaries, large text, dark mode, Reduce Motion, and interrupted
   repeated taps remain usable.
9. Documentation labels such as “Shared product language” never appear inside the app UI.

---

## Task 0: Protect the shared workspace before dependency mutation

**Files:**

- Read only: GitButler workspace state
- Temporary snapshot: `/private/tmp/kyomi-mobile-bun-lock-before-sdk57`
- No repository edit

**Produces:** evidence of existing `bun.lock` ownership and a byte-for-byte pre-upgrade snapshot.

- [x] Run `but diff` and record the current mobile-plan and `bun.lock` ownership.
- [x] Copy `bun.lock` to `/private/tmp/kyomi-mobile-bun-lock-before-sdk57`.
- [x] Record:

  ```bash
  node --version
  bun --version
  cd apps/mobile
  bunx expo install --check
  bunx expo-doctor@latest
  ```

- [x] Confirm the existing `apps/mobile/ios` and `apps/mobile/android` trees are generator-owned and
      have no uncommitted product customization.
- [x] If the native trees contain user changes, do not run clean prebuild; stop and coordinate.
- [ ] If GitButler cannot later separate new lockfile dependency changes from another branch, stop
      before checkpointing rather than claiming the whole lockfile.

Expected precondition:

- Node satisfies SDK 57's minimum.
- Expo 56 drift is reported before the upgrade.
- The mobile plan is the only existing mobile-foundation change.

## Task 1: Upgrade and atomically replace the template

**Files:**

- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.json`
- Modify: `apps/mobile/tsconfig.json`
- Modify: `apps/mobile/README.md`
- Delete: `apps/mobile/metro.config.js`
- Delete: `apps/mobile/src/global.css`
- Delete: `apps/mobile/src/css.d.ts`
- Delete: `apps/mobile/src/uniwind-types.d.ts`
- Modify later through Expo Prebuild: `apps/mobile/ios/**`
- Modify later through Expo Prebuild: `apps/mobile/android/**`
- Modify through Bun/Expo commands: attributable portions of `bun.lock`

**Produces:** an SDK 57 workspace with a public-package boundary and no unused welcome-template
runtime.

- [x] From `apps/mobile`, upgrade first:

  ```bash
  bunx expo install expo@latest
  bunx expo install --fix
  ```

  Accept the SDK 57-compatible patch versions chosen by Expo. Do not rewrite them to values copied
  from this plan.

- [x] Install the native UI/icon and universal web-fallback dependencies through Expo:

  ```bash
  bunx expo install @expo/ui react-native-svg react-dom react-native-web @expo/metro-runtime
  ```

- [x] Add the workspace dependency through Bun:

  ```bash
  bun add --cwd apps/mobile '@kyomi/ui@workspace:*'
  ```

- [x] Remove template-only dependencies:

  ```bash
  bun remove --cwd apps/mobile \
    tailwindcss \
    uniwind \
    react-native-mmkv \
    react-native-nitro-image \
    react-native-nitro-modules \
    expo-status-bar
  ```

- [x] Replace the route source in Task 3 in the same working checkpoint before deleting the
      Uniwind CSS entrypoint and Metro wrapper. Never leave `_layout.tsx` importing a deleted file.
- [x] Normalize `apps/mobile/app.json`:
  - `name`: `Kyomi`
  - `slug`: `kyomi`
  - `scheme`: `kyomi`
  - `orientation`: `default`
  - `userInterfaceStyle`: `automatic`
  - keep Expo Router plugin and React Compiler experiment
  - retain the current iOS bundle identifier and Android package
- [x] Remove direct-source aliases from `apps/mobile/tsconfig.json`; package subpaths must resolve
      through `packages/ui/package.json`.
- [x] Add durable scripts:

  ```json
  {
    "build": "expo export --platform all --output-dir dist",
    "doctor": "expo-doctor",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
  ```

  If `expo-doctor` is not a local binary, keep the root check command documented instead of adding
  an invalid script.

Acceptance:

- `bunx expo install --check` is clean after all dependency work.
- `apps/mobile` declares `@kyomi/ui` as a workspace dependency.
- No mobile alias bypasses public exports.
- No unused Uniwind/MMKV/Nitro runtime remains.
- The lockfile diff is attributable or explicitly held from checkpointing.

## Task 2: Add the smallest native-safe shared UI contract test-first

**Files:**

- Create: `packages/ui/src/native/theme.ts`
- Create: `packages/ui/src/native/motion.ts`
- Create: `packages/ui/src/icons/mingcute-native.ts`
- Modify: `packages/ui/src/icons/README.md`
- Modify: `packages/ui/package.json`
- Create: `tests/web/integration/src/packages/ui/native-contracts.test.ts`
- Modify: `scripts/check-boundaries.ts`

**Public interfaces:**

```ts
// @kyomi/ui/native/theme
export const kyomiNativeBrand: {
  readonly matcha: {
    readonly color: "#a8d480";
    readonly onColor: "#17240c";
  };
};

// @kyomi/ui/icons/mingcute-native
export type MingcuteNativePath = {
  readonly d: string;
  readonly fillRule?: "evenodd" | "nonzero";
};

export type MingcuteNativeIcon = {
  readonly viewBox: "0 0 24 24";
  readonly paths: readonly MingcuteNativePath[];
};

export const Rss2LineNativeIcon: MingcuteNativeIcon;

// @kyomi/ui/native/motion
export type NativeMotionIntent = "selection-change";
export type NativeMotionEffect = "selection-surface-fade" | "selection-surface-instant";

export type NativeMotionVisualOutcome = {
  readonly effect: NativeMotionEffect;
  readonly selectedSurfaceAlpha: number;
};

export function resolveNativeMotionEffect(
  intent: NativeMotionIntent,
  reducedMotion: boolean,
): NativeMotionVisualOutcome;
```

- [x] Write a failing contract test that asserts:
  - the three exact `packages/ui/package.json` export keys;
  - exact matcha values;
  - exact RSS viewBox/path objects and fill-rule semantics;
  - `selection-change + false` resolves to `selection-surface-fade`;
  - `selection-change + true` resolves to `selection-surface-instant`;
  - both outcomes use the same selected-surface alpha;
  - no timing/physics key appears in either outcome.
- [ ] Run the focused test and confirm RED because the source modules/exports do not exist. Do not
      claim that an aliased Vitest import alone proves the package export map.
- [x] Add the three pure-TypeScript modules. Implement the motion map exhaustively with
      `satisfies Record<...>` so new intents/effects create type errors until mapped.
- [x] Add only these package exports:

  ```json
  {
    "./icons/mingcute-native": "./src/icons/mingcute-native.ts",
    "./native/motion": "./src/native/motion.ts",
    "./native/theme": "./src/native/theme.ts"
  }
  ```

- [x] Record Mingcute provenance and Apache-2.0 licensing in the icon README. Preserve path
      `fillRule` data rather than flattening icons to `string[]`.
- [x] Add `apps/mobile/src` to the source roots scanned by `scripts/check-boundaries.ts`.
- [x] Run the focused contract test and confirm GREEN.
- [x] From `apps/mobile`, prove real export-map resolution without the web TypeScript alias:

  ```bash
  bun -e 'await Promise.all([
    import("@kyomi/ui/icons/mingcute-native"),
    import("@kyomi/ui/native/motion"),
    import("@kyomi/ui/native/theme"),
  ])'
  ```

Acceptance:

- The native contracts import no React, DOM, CSS, `motion/react`, or native runtime.
- Only the icon, accent, and motion intent consumed by the scaffold are public.
- Exact visible motion semantics are shared; native timing remains absent.

## Task 3: Build one universal native inbox tree

**Files:**

- Modify: `apps/mobile/src/app/_layout.tsx`
- Modify: `apps/mobile/src/app/index.tsx`
- Create: `apps/mobile/src/components/mingcute-icon.tsx`
- Create: `apps/mobile/src/hooks/use-reduced-motion.ts`
- Create: `apps/mobile/src/modules/inbox/model.ts`
- Create: `apps/mobile/src/modules/inbox/screen.tsx`
- Create: `apps/mobile/src/modules/inbox/row.tsx`
- Create: `apps/mobile/src/modules/inbox/row.ios.tsx`
- Create: `apps/mobile/src/modules/inbox/row.android.tsx`
- Delete atomically after route replacement:
  - `apps/mobile/metro.config.js`
  - `apps/mobile/src/global.css`
  - `apps/mobile/src/css.d.ts`
  - `apps/mobile/src/uniwind-types.d.ts`

**Interfaces:**

```ts
type InboxPreviewItem = {
  readonly id: string;
  readonly source: string;
  readonly title: string;
  readonly summary: string;
  readonly timestamp: string;
};

type InboxRowProps = {
  readonly item: InboxPreviewItem;
  readonly selected: boolean;
  readonly reducedMotion: boolean;
  readonly onSelect: (id: string) => void;
};
```

- [x] Inspect the installed SDK 57 declarations for universal `Host`, `List`, `ListItem`,
      `RNHostView`, row-background, and animation modifiers before writing imports. Do not invent API
      names from older examples.
- [x] Create three representative article fixtures with realistic source/title/summary/timestamp
      copy. Do not render architectural explanation or wireframe annotations as product content.
- [x] Implement `MingcuteIcon` with `react-native-svg`:
  - consumes the public renderer-neutral icon object;
  - forwards `fillRule`;
  - defaults to the current text/secondary color;
  - uses a 24×24 viewBox;
  - supports `accessibilityElementsHidden`/equivalent decorative use;
  - adds no box, circle, or background around the RSS glyph.
- [x] Implement `useReducedMotion` with `AccessibilityInfo.isReduceMotionEnabled()` plus the
      `reduceMotionChanged` subscription. Clean up the subscription.
- [x] Implement `screen.tsx` as the only screen hierarchy:
  - one universal `Host`;
  - one universal `List`;
  - local selected-row state;
  - the same source/title/summary/timestamp data on both native platforms and web;
  - no `@expo/ui/swift-ui` or `@expo/ui/jetpack-compose` import;
  - no opacity, scale, translation, duration, or spring constant.
- [x] Implement the fallback `row.tsx` for the universal web bundle with React Native primitives
      only. Keep it flat and content-led.
- [x] Implement `row.ios.tsx` and `row.android.tsx` with the exact same props and visible hierarchy.
      Their differences are limited to:
  - the native modifier/API necessary for the platform;
  - the `RNHostView` placement required to host the Mingcute SVG;
  - native animation timing/physics for the resolved effect;
  - native semantic color/type APIs.
- [x] In both native row variants:
  - call `resolveNativeMotionEffect("selection-change", reducedMotion)`;
  - exhaustively switch on the returned effect;
  - map `selection-surface-fade` to a native SwiftUI/Compose animation;
  - map `selection-surface-instant` to the platform's instant/snap behavior;
  - use the shared selected-surface alpha;
  - rely on native iOS press highlighting and Android ripple for press response;
  - do not scale, dim, translate, round, outline, elevate, or separate resting rows.
- [x] Use Expo Router's native stack for the “Inbox” title and navigation chrome. The app should
      not draw a fake web header.
- [x] Replace the welcome route and CSS import, then remove Uniwind files and the trivial Metro
      wrapper in the same patch.

Static acceptance:

- There is exactly one `screen.tsx` and no `screen.ios.tsx`/`screen.android.tsx`.
- The shared screen contains no platform-subpackage import and no visual-effect constants.
- Both platform row variants consume the same shared effect resolver.
- `rg` finds no `className`, Uniwind import, direct `packages/ui/src` alias, DOM UI import, SF
  Symbol, or Material Symbol in `apps/mobile/src`.
- The same Mingcute path and same selection alpha reach iOS, Android, and web.

## Task 4: Regenerate native projects from the upgraded config

**Files:**

- Regenerate: `apps/mobile/ios/**`
- Regenerate: `apps/mobile/android/**`

**Produces:** deterministic SDK 57 native projects matching the declared Expo config.

- [x] Reconfirm that the native directories still contain no user/product customization.
- [ ] Run:

  ```bash
  cd apps/mobile
  bunx expo prebuild --clean
  ```

  Clean prebuild is deliberate: it deletes and recreates only the verified generator-owned
  `apps/mobile/ios` and `apps/mobile/android` directories. Running prebuild without `--clean` can
  layer nondeterministic changes.

- [x] Install iOS pods if prebuild did not complete the install:

  ```bash
  bunx pod-install
  ```

- [x] Inspect the generated identifiers and schemes:
  - app name/slug/scheme are Kyomi;
  - existing placeholder package identifiers remain unchanged;
  - iOS minimum and Android compile/target levels match SDK 57;
  - Hermes and the New Architecture remain enabled if selected by Expo.
- [ ] Run prebuild a second time only if the first run reports a transient generation failure. Do
      not hand-patch generated Swift/Kotlin to hide a config or dependency defect.

Acceptance:

- Native projects are generated from the SDK 57 manifest.
- No custom native module or handwritten native UI has been introduced.
- Placeholder store identifiers are reported as an explicit release blocker.

## Task 5: Verify package, bundle, native, and visual boundaries

**Files:**

- Modify only for demonstrated defects in Tasks 1–4.
- Do not create “proof” files for checks that were not run.

### Focused static checks

- [ ] Run:

  ```bash
  bun run fmt:check
  bun run lint
  bun run typecheck
  bun run check:boundaries
  bun run test:web:integration -- native-contracts.test.ts
  ```

  If the repository uses a different focused Vitest script, use the existing script and record the
  exact command/result.

- [x] Run from `apps/mobile`:

  ```bash
  bunx expo install --check
  bunx expo-doctor@latest
  bun run typecheck
  bun run lint
  bun run build
  ```

- [ ] If the all-platform export hides a target-specific error, export separately:

  ```bash
  bunx expo export --platform ios --output-dir dist-ios
  bunx expo export --platform android --output-dir dist-android
  bunx expo export --platform web --output-dir dist-web
  ```

Bundle acceptance:

- iOS and Android bundle the same `screen.tsx`.
- Only the corresponding `row.<platform>.tsx` resolves for each native target.
- Web resolves `row.tsx`.
- No opposite-platform view-config error appears.
- No browser-only `@kyomi/ui` module enters a native bundle.

### Native build checks

- [ ] Build or run the iOS target with the available Xcode simulator/toolchain.
- [ ] Build or run the Android target with the available emulator/Gradle toolchain.
- [x] Classify missing Xcode, simulator, Android SDK, emulator, network, or certificate evidence as
      tooling/external proof—not a product pass or product defect.

### Live visual and accessibility checks

On both platforms, verify:

- [ ] native navigation chrome and safe-area behavior;
- [ ] contiguous flat rows with no card gaps/outlines/shadows/elevation/asymmetric shapes;
- [ ] source → title → summary hierarchy and readable timestamp;
- [ ] bare Mingcute RSS line icon;
- [ ] one row accessibility target with the icon decorative;
- [ ] low-alpha matcha selection surface;
- [ ] platform-native press response (iOS highlight, Android ripple);
- [ ] Material 3 Expressive typography/overscroll/motion on Android without resting cardification;
- [ ] system typography and native list behavior on iOS;
- [ ] dark mode;
- [ ] large Dynamic Type/font scale;
- [ ] long source names and two-line title/summary truncation;
- [ ] Reduce Motion uses the instant selection outcome;
- [ ] repeated and interrupted taps settle on the latest selected row.

Do not call the visual design verified when no simulator/device was observed. In that case, report
static/bundle proof separately from missing live proof.

## Task 6: Document the scaffold and checkpoint only owned changes

**Files:**

- Modify: `apps/mobile/README.md`
- Modify: this plan only to check completed boxes; do not rewrite decisions during execution

- [x] Document:
  - one universal native screen tree;
  - selective platform row/motion/host seams;
  - shared native-safe package subpaths;
  - Mingcute path-data approach;
  - shared effect vs platform physics boundary;
  - “quiet at rest, expressive in response” visual rule;
  - local run/check commands;
  - explicit non-goals and release identifier blocker;
  - production list/device benchmark gate.
- [x] Run `but diff` and identify exact change IDs owned by this mobile checkpoint.
- [x] Exclude unrelated `fix/ui`, Turbo, web, skill, report, and existing lockfile hunks.
- [ ] If new lockfile changes cannot be separated, coordinate rather than committing the entire
      lockfile.
- [x] Commit a coherent local checkpoint with GitButler:

  ```bash
  but commit mobile/native-ui-foundation -c \
    -m "feat(mobile): scaffold native ui foundation" \
    --changes <owned-change-ids>
  ```

- [x] Do not push or create a pull request.

## Completion criteria

- Expo SDK 57 and all Expo-governed dependencies pass `expo install --check`.
- Expo Doctor reaches a clean result or every residual item is classified with evidence.
- `apps/mobile` uses one universal inbox screen tree and no full platform screen fork.
- SwiftUI renders the iOS controls; Material 3 Expressive Compose renders the Android controls.
- Platform seams are limited to proven host/modifier and native animation differences.
- Mingcute remains visible on both platforms through shared renderer-neutral geometry.
- Shared contracts contain exact matcha and selection effect semantics, with no shared physics.
- Normal and reduced selection outcomes are exhaustively mapped on both platforms.
- The resting design is flat/list-first and visually consistent with Kyomi web's product language.
- Android is expressive in interaction, not cardified at rest.
- Package export-map resolution, boundary checks, typechecks, lint, focused tests, and three-platform
  bundles pass.
- Native build/live checks are either passed or reported as missing external evidence.
- The fixture is not presented as production inbox or large-list performance proof.
- Placeholder store identifiers and real-data/device-benchmark work remain explicit follow-ups.
- Only owned changes are checkpointed locally; nothing is pushed.

## Deferred follow-ups

These are intentionally outside the scaffold and require their own plans:

- production bundle identifiers and signing/distribution;
- authentication/session storage and API synchronization;
- real inbox queries, cache, offline behavior, and persistence;
- reader rendering and content security boundary;
- production-scale list virtualization/device benchmarks;
- persisted actions and Mingcute line/fill state pairs;
- additional motion intents driven by real interactions;
- tabs, notifications, deep-link behavior, and app-store delivery.

## GSTACK REVIEW REPORT

| Review             | Passes | Status  | Result                                                                                                                                                                        |
| ------------------ | -----: | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Tune          |      1 | CLEAR   | Prior answers locked the review scope, builder mode, platform/native strategy, and parity posture.                                                                            |
| Engineering Review |      1 | CLEAR   | Resolved six execution gaps: universal tree, enforceable motion outcomes, export-map proof, lock ownership, atomic template removal/clean prebuild, and durable bundles.      |
| Design Review      |      1 | CLEAR   | Score improved from 5/10 to 9/10 by removing Android cardification, preserving source-first hierarchy, constraining matcha/Mingcute, and defining accessibility/state checks. |
| CEO Review         |      0 | NOT RUN | Not requested; Office Hours product decisions were already answered inline.                                                                                                   |
| DevEx Review       |      0 | NOT RUN | Not requested; command and package-boundary concerns were covered by engineering review.                                                                                      |

Engineering review found no remaining critical architecture or execution decision. The dependency
lock may still require coordination if GitButler cannot isolate generated hunks; this is an
execution ownership gate, not an unresolved product decision.

Design review covered information architecture, state coverage, core journey, anti-cardification,
system alignment, accessibility/responsiveness, and visual acceptance. Live simulator/device
observation remains required before claiming rendered visual proof.

**VERDICT:** ENGINEERING + DESIGN CLEARED — ready to implement.

NO UNRESOLVED DECISIONS

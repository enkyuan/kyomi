---
name: mobile
description: Build, refactor, review, or debug the Kyomi Expo Router mobile application in apps/mobile. Use for route and domain structure, Uniwind-first React Native styling, @expo/ui universal components, platform-native SwiftUI and Jetpack Compose renderers, Material 3 Expressive, active mobile dependency selection, native-safe shared UI, reader native or WebView integration, mobile data and persistence, Expo configuration, Swift or Kotlin Expo modules, iOS or Android work, and mobile tests. Use when deciding whether behavior belongs in an Expo route, a mobile domain, packages/ui, packages/reader, an existing apps/mobile dependency, an @expo/ui platform component, or a native module. Not for web-only, API-only, or final repository-wide verification work.
---

# Mobile

Build one Kyomi product language with platform-native iOS and Android expressions.

## Establish context

1. Read `AGENTS.md`, `apps/mobile/README.md`, `apps/mobile/app.json`, the nearest route and domain,
   relevant package exports, and any active mobile implementation plan.
2. Read [references/dependencies.md](references/dependencies.md) and retrieve the relevant official
   Expo, Uniwind, Apple, or Android documentation before using a framework, native API, modifier,
   platform file, module, or design behavior.
3. Inventory `apps/mobile/package.json`, actual imports, configuration, and installed package types
   before selecting a library or assuming an SDK, component, modifier, or native-build capability.
   Package presence means the capability is available, not that product behavior is implemented.
4. Prefer an active dependency or public `@kyomi/*` contract over adding an overlapping library.
5. Treat `apps/mobile` as an evolving product, not a template. Add structure only for present
   behavior and preserve decisions already established by an active plan.
6. Load `$architecture` before adding a domain convention, native dependency, test runner, shared
   entrypoint, or platform-specific ownership. Add `$packages`, `$design`, `$security`,
   `$environment`, and `$testing` when their boundaries apply.

## Route Expo expertise

Load the smallest relevant Expo skill set:

| Concern                             | Skill                 | Rule                                                                                                                                              |
| ----------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native component trees              | `$expo-ui`            | Load for every `@expo/ui` implementation or review. Confirm the installed API with its component-list script and `.d.ts` files.                   |
| Routes and navigation               | `$expo-router`        | Own stacks, tabs, links, headers, search, modals, sheets, route groups, and route parameters here.                                                |
| Native interaction and presentation | `$expo-native-ui`     | Use for semantic colors, safe areas, controls, accessibility, motion, media, and visual effects; apply Kyomi project rules over generic defaults. |
| Existing app placement              | `$architecture`       | Follow Kyomi's domain layout. Use `$expo-project-structure` only as new-project background, never as a reason to migrate an established tree.     |
| Network and offline behavior        | `$expo-data-fetching` | Use for every request, API client, cache, cancellation, and offline contract. Pair with `$security` and `$environment` when applicable.           |
| Actual Swift or Kotlin              | `$expo-module`        | Use only after Expo and `@expo/ui` cannot express a required native capability.                                                                   |
| Custom native runtime               | `$expo-dev-client`    | Use when local modules, config plugins, or native dependencies require a development build.                                                       |

## Grow by domain

```text
apps/mobile/src/
  app/                           Expo Router layouts, route inputs, and delegation only
  modules/<domain>/
    components/<area>/
    hooks/
    lib/
    services/
    model.ts
    screen.tsx                   Required default or non-native fallback
    screen.ios.tsx               SwiftUI renderer when the domain needs one
    screen.android.tsx           Compose renderer when the domain needs one
  components/                    UI reused by multiple mobile domains
  lib/<capability>/              Infrastructure reused by multiple mobile domains
  hooks/                         Hooks reused by multiple mobile domains
  theme/                         App-level platform color and presentation adapters
```

- Do not create directories until a real responsibility exists.
- Keep route files focused on navigation, route parameters, layout composition, and rendering the
  owning domain screen.
- Keep product behavior, state, services, and screen bodies in `src/modules/<domain>`.
- Keep `.ios.tsx` and `.android.tsx` components outside `src/app`; Expo Router route files do not
  support platform extensions. Give paired renderers the same public props and a default fallback.
- Keep native-only adapters near their mobile owner. Promote only stable, renderer-neutral
  contracts with multiple consumers into a package.

## Name files

- Use lowercase kebab-case for authored TypeScript and TSX files and directories.
- Preserve Expo Router conventions such as `_layout.tsx`, `index.tsx`, `[param].tsx`, and `(auth)`.
- Keep React component and screen symbols PascalCase.
- Name a single-hook file `use-<purpose>.ts`; use precise roles such as `screen.tsx`, `model.ts`,
  `storage.ts`, `client.ts`, `schema.ts`, `bridge.ts`, or `swift-motion.ts`.
- Use `index.tsx` only when the containing area gives the component its name. Avoid broad barrels.

## Choose the rendering layer

1. Use Expo Router's native navigation instead of recreating headers, tabs, sheets, or transitions
   inside a screen.
2. Start with universal `@expo/ui` components for shared native controls and small trees.
3. Use paired `@expo/ui/swift-ui` and `@expo/ui/jetpack-compose` renderers when the feature needs
   platform-specific hierarchy, behavior, components, modifiers, or expression.
4. Use React Native for custom cross-platform composition, renderer fallbacks, and native-safe
   islands. Style these surfaces with Uniwind instead of `StyleSheet` when Uniwind can express the
   requirement.
5. Write Swift or Kotlin only behind an Expo Modules API boundary when the layers above cannot meet
   a concrete requirement.

## Style React Native with Uniwind

- Prefer `className` on React Native `View`, `Text`, `Pressable`, `TextInput`, images, and list
  surfaces for static layout, spacing, sizing, typography, semantic colors, borders, radii,
  opacity, transforms, platform variants, and interaction states.
- Prefer mapped props such as `contentContainerClassName`, `placeholderTextColorClassName`,
  `tintColorClassName`, and `colorClassName` over their style or raw-color equivalents. Use
  Uniwind's `accent-*` utilities for mapped non-style color props.
- Keep shared fonts and semantic roles in `src/global.css`; use complete utility strings that the
  Tailwind compiler can discover. Select between complete strings for runtime variants instead of
  interpolating utility names.
- Wrap a reusable third-party React Native component once with `withUniwind` when it forwards
  compatible style or color props. Use `useResolveClassNames` only for an API that requires a style
  object and cannot be wrapped cleanly.
- Use `style`, `contentContainerStyle`, or `StyleSheet` only for values that must remain runtime
  objects: Reanimated worklet output, continuously computed geometry, native opaque color values,
  an unsupported third-party prop, or an `@expo/ui` host constraint. Keep the exception narrow and
  do not duplicate the same responsibility in both `className` and `style`.
- Do not pass Uniwind classes into SwiftUI or Jetpack Compose components. Use their native props,
  modifiers, typography, colors, and motion APIs.

For every `@expo/ui` tree:

- Wrap it in `Host` imported from `@expo/ui`.
- Isolate platform imports in `.ios.tsx` or `.android.tsx`; never load one platform package on the
  other.
- Use `RNHostView` only to embed a necessary React Native child in a native toolkit tree.
- Inspect the installed component and modifier types; do not code from latest-documentation memory.
- Treat JSX-created native lists as unproven for large inbox data until device profiling validates
  their JS, memory, and virtualization boundary.

Read [native-interface.md](references/native-interface.md) before designing a screen, changing
shared mobile presentation contracts, using SwiftUI or Material 3 Expressive, or writing native
Swift or Kotlin.

## Use active dependencies

Read [dependencies.md](references/dependencies.md) before adding, replacing, upgrading, or directly
using a mobile dependency.

- Treat `apps/mobile/package.json` and installed types as version authority; treat the dependency
  reference as ownership guidance.
- Reuse the existing auth, native UI, navigation, font, storage, linking, network, motion, SVG,
  safe-area, and Uniwind stack instead of installing parallel libraries.
- Do not import framework transport packages merely because they are declared, and do not call a
  configured dependency unused without checking config plugins, Metro, native projects, and
  transitive runtime requirements.
- Install Expo-governed packages with `bunx expo install`; use
  `bun add --cwd apps/mobile <package>` for other approved additions.

## Preserve native boundaries

- Consume only native-safe `@kyomi/ui` exports. Do not import DOM components, app source, or the
  complete web stylesheet into mobile.
- Use `@kyomi/reader/native` for native rendering and `@kyomi/reader/webview` for WebView document
  generation. Keep `@kyomi/reader/web` out of native code.
- Keep browser globals, Node-only modules, web CSS, and server secrets out of native bundles.
- Define serialization, fallback, migration, and unavailable-module behavior before using native
  persistence or Nitro modules.
- Prefer Expo configuration, config plugins, and JavaScript or TypeScript changes. Review generated
  `ios` and `android` changes as generator-owned output; avoid ad hoc AppDelegate, Xcode, Gradle, or
  manifest edits.

## Verify

1. Note that no mobile test runner is currently wired. Use `$architecture` and `$testing` before
   introducing the first runner or mobile test tree.
2. Run `bun run --cwd apps/mobile typecheck`, `lint`, and `fmt:check`.
3. Run `bunx expo install --check` when the Expo or React Native dependency graph changes.
4. Bundle or run every affected platform. Platform-specific imports require both iOS and Android
   verification; include the fallback target when it changed.
5. Check Dynamic Type or font scaling, screen readers, focus order, hit targets, dark appearance,
   reduced motion, loading, empty, error, and offline states as applicable.
6. Use Expo Go when the installed dependencies support it. Use a development build and real native
   target when local modules, config plugins, platform code, or native configuration changes.
7. Finish through `$qa`.

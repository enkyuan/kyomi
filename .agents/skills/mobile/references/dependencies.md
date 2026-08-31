# Active mobile dependencies

Read `apps/mobile/package.json` before every change. Its exact versions and installed `.d.ts` files
are authoritative; this reference records intended ownership so agents reuse the current stack.

## Product and platform capabilities

| Dependency                                          | Use in Kyomi                                                                                                                                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expo-router`                                       | Own file-based routes, navigation layouts, links, deep-link routing, native headers, tabs, sheets, and web fallback routing. Do not import `@react-navigation/*` directly.                                                |
| `@expo/ui`                                          | Build universal native controls first, then selective SwiftUI or Jetpack Compose seams. Wrap trees in `Host` and confirm installed component and modifier types.                                                          |
| `uniwind` + `tailwindcss`                           | Style React Native and web-fallback surfaces through `className`, semantic utilities from `src/global.css`, platform selectors, and supported state variants. Keep `metro.config.js` and generated Uniwind types aligned. |
| `@kyomi/ui`                                         | Consume only public native-safe theme, motion, and Mingcute geometry exports; never deep-import package source or DOM components.                                                                                         |
| `@kyomi/auth`                                       | Reuse runtime-neutral auth schemas, capabilities, redirect rules, and form contracts instead of duplicating web behavior.                                                                                                 |
| `better-auth` + `@better-auth/expo`                 | Use the existing native auth client/provider. Keep the server authoritative and preserve its SecureStore cookie/session and browser callback flow.                                                                        |
| `expo-secure-store`                                 | Store the Better Auth session or other explicitly approved secrets. Never persist passwords, reset tokens, or ordinary preferences here.                                                                                  |
| `expo-linking` + `expo-web-browser`                 | Use through the existing auth and navigation boundaries for external browser flows and callbacks. Keep schemes, trusted origins, and production app links security-reviewed.                                              |
| `expo-network`                                      | Provide reachability hints for offline UX. Do not treat network state as proof that an API request will succeed.                                                                                                          |
| `expo-font` + `@expo-google-fonts/*`                | Load the declared Inter, DM Sans, and JetBrains Mono faces through `src/theme/fonts.ts`; coordinate startup with the splash screen. Native SwiftUI and Compose type roles remain platform-owned.                          |
| `expo-splash-screen`                                | Hold and release startup presentation around required initialization. Prefer its config plugin for static splash configuration.                                                                                           |
| `expo-system-ui`                                    | Configure supported system chrome behavior when the feature requires it; avoid manual native project edits.                                                                                                               |
| `react-native-safe-area-context`                    | Own safe-area containers and insets around React Native content. Native navigation and `@expo/ui` hosts keep their own inset contracts.                                                                                   |
| `react-native-reanimated` + `react-native-worklets` | Run gesture, layout, and UI-thread motion. Keep animated runtime objects in `style`; translate shared Kyomi motion intents instead of sharing framework objects.                                                          |
| `react-native-svg`                                  | Render the project-owned native Mingcute and logo geometry, including islands embedded with `RNHostView`.                                                                                                                 |

## Framework-owned dependencies

- Treat `expo`, `react`, and `react-native` as the application runtime.
- Treat `@expo/metro-runtime`, `react-dom`, `react-native-web`, and the `main` entry
  `expo-router/entry` as bundler or web-fallback infrastructure. Do not build product abstractions
  around them or import them directly unless the framework's installed documentation requires it.
- Use `expo-constants` only when code genuinely needs app, build, or runtime metadata. Declaration
  alone is not a reason to add a source import.
- Keep Expo plugins in `app.json` aligned with installed packages. Before removing a dependency
  with no direct import, inspect app config, Metro config, native projects, auth integration, and
  package peer requirements.

## Dependency decision order

1. Reuse a public `@kyomi/*` contract when the responsibility is already shared.
2. Reuse an installed Expo or React Native capability when it owns the platform concern.
3. Extend the owning app domain with a narrow adapter.
4. Add a dependency only after documenting the missing capability, platforms, native-build impact,
   security boundary, maintenance cost, and removal path.

Use official references alongside installed types:

- [Uniwind supported class names](https://docs.uniwind.dev/class-names) and
  [third-party component integration](https://docs.uniwind.dev/components/other-components)
- [Expo SDK 57 modules](https://docs.expo.dev/versions/v57.0.0/) and
  [Expo UI](https://docs.expo.dev/versions/v57.0.0/sdk/ui/)
- [Expo Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/)
- [Better Auth Expo integration](https://better-auth.com/docs/integrations/expo)

## Documentation-first framework sources

Before editing framework, native, or platform-design code:

1. Read `apps/mobile/package.json`, the installed declarations/source, the nearest owner skill, and
   the existing component or route seam.
2. Use the matching Expo SDK version. The current baseline is Expo SDK 57, so prefer the
   [SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/) over an unpinned latest example.
3. For `@expo/ui`, start with the [Expo UI docs](https://docs.expo.dev/versions/v57.0.0/sdk/ui/)
   and inspect the installed component/modifier declarations. Use universal components first;
   isolate `@expo/ui/swift-ui` and `@expo/ui/jetpack-compose` imports in platform files.
4. For styling, use [Uniwind](https://docs.uniwind.dev/) and its
   [supported class names](https://docs.uniwind.dev/class-names). Keep runtime values and native
   toolkit modifiers in their existing narrow exceptions.
5. For a custom native capability, read [Expo Modules](https://docs.expo.dev/modules/overview/)
   before writing Swift or Kotlin. Use a module only when Expo UI, Router, React Native, and the
   existing app seam cannot meet a concrete requirement.
6. For iOS presentation, consult [Apple HIG](https://developer.apple.com/design/human-interface-guidelines)
   and the relevant [SwiftUI documentation](https://developer.apple.com/documentation/swiftui).
   For Android presentation, consult [Compose design systems](https://developer.android.com/develop/ui/compose/designsystems),
   [Material 3](https://developer.android.com/develop/ui/compose/designsystems/material3), and the
   relevant adaptive-layout guidance.
7. Record the installed version/type evidence, official URLs, applied native rule, any Kyomi
   divergence, and focused checks in the completion report. Do not commit third-party docs.

# Kyomi native interface contract

Use one product model and semantic design language without forcing iOS and Android into identical
view trees.

## Translate the web product

Inspect the closest web surface, `packages/ui/src/styles/theme.css`, native-safe package exports,
and any active mobile design plan before choosing presentation. Preserve intent, not CSS.

| Kyomi signal      | Share across clients                                       | iOS expression                                                       | Android expression                                                      |
| ----------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Content hierarchy | Information order, labels, actions, states                 | SwiftUI navigation, sections, lists, forms, and sheets               | Compose navigation surfaces, lists, cards, toolbars, and sheets         |
| Color             | Proven brand accents and semantic roles                    | System semantic surfaces and labels; apply Kyomi accents selectively | Material dynamic or seeded color roles; apply Kyomi accents selectively |
| Typography        | Reading hierarchy and emphasis                             | Dynamic Type text styles                                             | Material 3 type roles and font scaling                                  |
| Shape and density | Relative emphasis and grouping                             | Native SwiftUI containers and continuous platform geometry           | Material 3 Expressive shape scale, spacing, and adaptive layout         |
| Icons             | Kyomi's semantic icon and persisted-state rules            | Use the project-selected native-safe Mingcute renderer when required | Use the same project-selected Mingcute geometry when required           |
| Motion            | Named intent, effect category, and reduced-motion fallback | Translate through SwiftUI animation                                  | Translate through Compose motion                                        |

Do not copy web hex tables, Tailwind classes, fixed desktop dimensions, hover behavior, or radius
values into native code. Do not invent shared tokens before reuse is demonstrated.

## Build iOS with SwiftUI

- Author ordinary iOS screen trees in TypeScript or TSX through `@expo/ui/swift-ui`, not in
  free-standing Swift files.
- Put SwiftUI trees and modifiers in `.ios.tsx` domain components, wrapped by `Host` from
  `@expo/ui`; keep Expo Router navigation in ordinary route files.
- Prefer native navigation titles, lists, forms, sections, menus, sheets, alerts, swipe actions,
  semantic colors, Dynamic Type, VoiceOver semantics, and system interaction feedback.
- Use SwiftUI modifiers for a SwiftUI subtree. Use `RNHostView` only for a required React Native
  island such as a project-owned icon renderer.
- Let iOS feel like iOS. Reflect Kyomi through information hierarchy, restrained accents, icon
  meaning, reading comfort, and motion intent rather than a pixel copy of the web or Android UI.

Write actual Swift only when a required Apple API, native view, modifier, or lifecycle capability
is unavailable through Expo and the installed `@expo/ui` surface:

1. Confirm the gap in installed package types and official Expo documentation.
2. Get agreement before extending `@expo/ui` or adding a local module.
3. Use `$expo-module`; expose a narrow typed TypeScript facade and explicit errors or fallbacks.
4. Keep UI state and product rules in shared TypeScript. Keep Swift responsible only for the native
   capability.
5. Add the Kotlin counterpart when the contract is cross-platform, or declare and test an
   intentional iOS-only capability.
6. Prefer a config plugin over manual generated-project edits and use `$expo-dev-client` for live
   validation.

## Build Android with Material 3 Expressive

- Author Android native trees in `.android.tsx` components through
  `@expo/ui/jetpack-compose`; do not add Kotlin merely to obtain standard Compose UI.
- Confirm the installed `@expo/ui` `Host` and component types before claiming Material 3
  Expressive support. Current implementations may supply the expressive theme internally.
- Use Material components, semantic color roles, typography, tonal elevation, shape, ripple,
  overscroll, and motion together to communicate hierarchy. Expressive does not mean adding motion
  or oversized shapes everywhere.
- Prefer device dynamic color where it preserves legibility and product meaning. Use a Kyomi seed
  or accent selectively instead of replacing every Material role with web colors.
- Keep touch targets, TalkBack semantics, font scaling, predictive system navigation, window
  insets, large screens, and reduced motion first-class.
- Map shared motion intents to native Compose springs or tweens. Remove spatial effects or make
  state changes immediate when reduced motion requires it.

Material 3 Expressive evolves with Compose. Verify current behavior against the installed package
and [Android's Material 3 Compose guidance](https://developer.android.com/develop/ui/compose/designsystems/material3).

## Share contracts, not renderers

- Share route-neutral models, service results, form schemas, semantic color or icon data, and motion
  intent names.
- Keep SwiftUI and Compose component trees independent but give paired renderers identical public
  props, state transitions, analytics meaning, and error behavior.
- Follow Kyomi's icon rule: line icons for ordinary actions and filled icons only for persisted
  state. A generic Expo skill's symbol preference does not override the project-selected Mingcute
  contract.
- Keep native list performance as a measured boundary. Profile representative inbox sizes on
  devices before treating JSX-generated native list items as production virtualization.

## Review both expressions

Verify equivalent behavior and deliberately native presentation on iOS and Android. Check compact
and large devices, light and dark appearance, increased text size, screen readers, reduced motion,
slow or offline data, long content, empty and error states, keyboard avoidance, and interrupted
interactions. Record platform differences as intentional decisions rather than silently drifting.

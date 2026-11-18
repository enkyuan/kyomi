import { mock } from "bun:test";
import { resolve } from "node:path";
import { createElement, type ReactNode } from "react";

type Props = Record<string, unknown> & { children?: ReactNode };

/** Maps React Native primitives to DOM tags that keep the accessibility props visible. */
function host(tag: string) {
  return ({
    children,
    accessibilityRole,
    accessibilityLabel,
    accessibilityState,
    importantForAccessibility,
    numberOfLines,
    selectable,
    onPress,
  }: Props) =>
    createElement(
      tag,
      {
        "data-role": accessibilityRole as string | undefined,
        "data-label": accessibilityLabel as string | undefined,
        "data-expanded": (accessibilityState as { expanded?: boolean } | undefined)?.expanded,
        "data-important": importantForAccessibility as string | undefined,
        "data-selectable": selectable ? "true" : undefined,
        "data-lines": numberOfLines as number | undefined,
        "data-pressable": onPress ? "true" : undefined,
      },
      children,
    );
}

/**
 * bun's module mocks outlive the file that registers them, and the names a mock exports are fixed
 * by the first registration: a later mock can change values but not add names. Every
 * `react-native` mock in this suite is therefore this superset, with only values overridden, so
 * the order bun runs the files in does not matter.
 */
const reactNativeMock = {
  Platform: { OS: "ios", select: <T>(spec: { ios?: T; default?: T }) => spec.ios ?? spec.default },
  StyleSheet: { create: <T>(styles: T) => styles, hairlineWidth: 1 },
  Dimensions: { get: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }) },
  useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
  useColorScheme: () => "light",
  Alert: { alert: (..._args: unknown[]) => undefined },
  Appearance: { setColorScheme: (_scheme: unknown) => undefined },
  AppState: { addEventListener: (..._args: unknown[]) => ({ remove: () => undefined }) },
  Linking: { openURL: async (_url: string) => true },
  Share: { share: async (_content: unknown) => ({ action: "sharedAction" }) },
  // The copy button's icon swap: a value that interpolates to itself, a timing that never runs.
  Animated: {
    Value: class {
      interpolate() {
        return 0;
      }
    },
    View: host("div"),
    timing: () => ({ start: () => undefined }),
  },
  Easing: { bezier: () => (t: number) => t },
  Modal: host("div"),
  View: host("div"),
  Text: host("span"),
  Pressable: host("button"),
  ScrollView: host("div"),
  Image: ({ source }: { source: { uri: string } }) => createElement("img", { src: source.uri }),
  FlatList: ({
    data,
    renderItem,
  }: {
    data: unknown[];
    renderItem: (info: { item: unknown; index: number }) => ReactNode;
  }) =>
    createElement(
      "div",
      { "data-list": "true" },
      data.map((item, index) => createElement("div", { key: index }, renderItem({ item, index }))),
    ),
};

/** Registers the shared `react-native` mock, with `overrides` replacing the values they name. */
export function mockReactNative(overrides: Record<string, unknown> = {}) {
  mock.module("react-native", () => ({ ...reactNativeMock, ...overrides }));
}

const AUTH_MODULE = resolve(import.meta.dir, "../../../../apps/mobile/src/lib/auth");

/**
 * Registers `lib/auth` with the secure-store backed client replaced by `authClient`. The export
 * names are the same in every test, for the reason given on `reactNativeMock`.
 */
export function mockMobileAuth(authClient: object = {}) {
  mock.module(AUTH_MODULE, () => ({
    authClient,
    getAuthCookie: () => "",
    resolveAuthOrigin: () => "https://api.kyomi.test",
  }));
}

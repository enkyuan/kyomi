import { mock } from "bun:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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

// bun's module mocks outlive the file that registers them, so this stays a superset of the
// names other mobile modules import from react-native.
mock.module("react-native", () => ({
  Platform: { OS: "ios", select: <T>(spec: { ios?: T; default?: T }) => spec.ios ?? spec.default },
  StyleSheet: { create: <T>(styles: T) => styles, hairlineWidth: 1 },
  Dimensions: { get: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }) },
  useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
  useColorScheme: () => "light",
  Alert: { alert: () => undefined },
  Linking: { openURL: async () => true },
  Share: { share: async () => ({ action: "sharedAction" }) },
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
}));

export function html(node: ReactNode): string {
  return renderToStaticMarkup(node as never);
}

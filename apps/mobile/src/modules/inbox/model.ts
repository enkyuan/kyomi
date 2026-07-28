export type InboxPreviewItem = {
  readonly id: string;
  readonly source: string;
  readonly title: string;
  readonly summary: string;
  readonly timestamp: string;
};

export type InboxRowProps = {
  readonly item: InboxPreviewItem;
  readonly selected: boolean;
  readonly reducedMotion: boolean;
  readonly onSelect: (id: string) => void;
};

export const inboxPreviewItems = [
  {
    id: "expo-native-ui",
    source: "Expo",
    title: "Universal native UI now speaks SwiftUI and Compose",
    summary:
      "A shared React tree can retain platform controls, typography, accessibility, and motion.",
    timestamp: "8m",
  },
  {
    id: "material-expressive",
    source: "Material Design",
    title: "Expressive motion works best when content stays calm",
    summary:
      "Ripple, overscroll, tonal response, and native physics carry the interaction without cardifying the feed.",
    timestamp: "24m",
  },
  {
    id: "kyomi-reading",
    source: "Kyomi Dispatch",
    title: "A quiet inbox leaves more room for the story",
    summary:
      "Source, title, and summary remain the visual anchors while native platform character handles the chrome.",
    timestamp: "1h",
  },
] as const satisfies readonly InboxPreviewItem[];

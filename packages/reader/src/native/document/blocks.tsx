import { Pressable, Text, View } from "react-native";
import { useState, type ComponentType, type ReactNode } from "react";
import type { ReaderBlock } from "../../core/document";
import { useReaderNative } from "./context";
import { keyedByContent } from "../../core/keys";
import { CodeBlockView } from "./code";
import { Checkbox, Disclosure } from "./icons";
import { EmbedBlockView, LinkCardBlock } from "./embed";
import { Inlines } from "./inline";
import { HtmlBlock, MathBlock } from "./islands";
import { FigureBlock, GalleryBlock, MediaFileBlock } from "./media";
import { imageAspectRatio, useBodyTextStyle } from "./style";
import { DividerBlock, HeadingBlock, PullQuoteBlock } from "./typography";
import { inlinesToText } from "./text";
import { TableBlock } from "./table";
import { ProseRun } from "./prose";
import type { ReaderSegment } from "./plan";

type Block<T extends ReaderBlock["type"]> = Extract<ReaderBlock, { type: T }>;

function marker(ordered: boolean, start: number | undefined, index: number): string {
  return ordered ? `${(start ?? 1) + index}.` : "•";
}

function ListBlock({ block }: { readonly block: Block<"list"> }) {
  const { theme } = useReaderNative();
  const base = useBodyTextStyle();
  const widest = marker(block.ordered, block.start, Math.max(0, block.items.length - 1)).length;
  const markerWidth = Math.max(18, widest * theme.fontSize * 0.62 + 6);
  return (
    <View accessibilityRole="list" style={{ gap: theme.blockGap * 0.4 }}>
      {keyedByContent(block.items).map(({ item, key, position: index }) => {
        const task = item.checked !== null;
        return (
          <View key={key} style={{ flexDirection: "row" }}>
            {task ? (
              <View
                accessibilityLabel={item.checked ? "Done" : "To do"}
                accessible
                style={{
                  alignItems: "center",
                  height: base.lineHeight,
                  justifyContent: "center",
                  width: markerWidth,
                }}
              >
                <Checkbox
                  background={theme.colors.background}
                  checked={Boolean(item.checked)}
                  color={item.checked ? theme.colors.foreground : theme.colors.muted}
                  size={Math.round(theme.fontSize * 0.8)}
                />
              </View>
            ) : (
              <Text
                importantForAccessibility="no-hide-descendants"
                maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
                style={{ ...base, textAlign: "right", width: markerWidth, paddingRight: 8 }}
              >
                {marker(block.ordered, block.start, index)}
              </Text>
            )}
            <View style={{ flex: 1, gap: theme.blockGap * 0.4 }}>
              <Blocks blocks={item.children} compact />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function QuoteBlock({ block }: { readonly block: Block<"quote"> }) {
  const { theme, host } = useReaderNative();
  const base = useBodyTextStyle();
  return (
    <View
      style={{
        borderLeftColor: theme.colors.quoteRule,
        borderLeftWidth: 3,
        gap: theme.blockGap * 0.6,
        paddingLeft: 14,
      }}
    >
      <Blocks blocks={block.children} muted />
      {block.attribution?.length ? (
        <Text
          accessibilityRole={block.citeUrl ? "link" : undefined}
          maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
          onPress={block.citeUrl ? () => host.openUrl(block.citeUrl as string) : undefined}
          style={{ ...base, color: theme.colors.muted, fontSize: theme.fontSize * 0.85 }}
        >
          — <Inlines inlines={block.attribution} />
        </Text>
      ) : null}
    </View>
  );
}

function CalloutBlock({ block }: { readonly block: Block<"callout"> }) {
  const { theme } = useReaderNative();
  const base = useBodyTextStyle();
  const title = block.title?.length ? block.title : null;
  const fallbackTitle = block.variant[0]!.toUpperCase() + block.variant.slice(1);
  return (
    <View
      accessible={false}
      style={{
        backgroundColor: theme.colors.callout[block.variant],
        borderRadius: 10,
        gap: theme.blockGap * 0.5,
        padding: 14,
      }}
    >
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
        style={{ ...base, fontFamily: theme.fonts.strong, fontSize: theme.fontSize * 0.9 }}
      >
        {title ? <Inlines inlines={title} /> : fallbackTitle}
      </Text>
      <Blocks blocks={block.children} />
    </View>
  );
}

function DetailsBlock({ block }: { readonly block: Block<"details"> }) {
  const { theme } = useReaderNative();
  const base = useBodyTextStyle();
  const [toggled, setToggled] = useState(false);
  const open = block.open !== toggled;
  return (
    <View
      style={{
        borderColor: theme.colors.border,
        borderRadius: 10,
        borderWidth: 1,
        overflow: "hidden",
      }}
    >
      <Pressable
        accessibilityLabel={inlinesToText(block.summary)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setToggled((value) => !value)}
        style={{ flexDirection: "row", gap: 8, padding: 12 }}
      >
        <View style={{ height: base.lineHeight, justifyContent: "center" }}>
          <Disclosure
            color={theme.colors.muted}
            open={open}
            size={Math.round(theme.fontSize * 0.8)}
          />
        </View>
        <Text
          maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
          style={{ ...base, flex: 1, fontFamily: theme.fonts.strong }}
        >
          <Inlines inlines={block.summary} />
        </Text>
      </Pressable>
      {open ? (
        <View style={{ gap: theme.blockGap * 0.6, paddingBottom: 12, paddingHorizontal: 12 }}>
          <Blocks blocks={block.children} />
        </View>
      ) : null}
    </View>
  );
}

function DefinitionListBlock({ block }: { readonly block: Block<"definitionList"> }) {
  const { theme } = useReaderNative();
  const base = useBodyTextStyle();
  return (
    <View style={{ gap: theme.blockGap * 0.6 }}>
      {keyedByContent(block.items).map(({ item, key }) => (
        <View key={key} style={{ gap: 4 }}>
          {item.terms.map((term, termIndex) => (
            <Text
              key={termIndex}
              maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
              selectable
              style={{ ...base, fontFamily: theme.fonts.strong }}
            >
              <Inlines inlines={term} />
            </Text>
          ))}
          {item.definitions.map((definition, definitionIndex) => (
            <View key={definitionIndex} style={{ gap: theme.blockGap * 0.4, paddingLeft: 16 }}>
              <Blocks blocks={definition} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function MediaTextBlock({ block }: { readonly block: Block<"mediaText"> }) {
  const { theme, host } = useReaderNative();
  const stacked = theme.columnWidth < 480;
  const mediaWidth = stacked ? theme.columnWidth : Math.round(theme.columnWidth * 0.4);
  const media = host.renderImage?.({
    image: block.image,
    aspectRatio: imageAspectRatio(block.image),
    accessibilityLabel: block.image.alt || undefined,
    radius: 6,
    fit: "cover",
    onPress: host.openImage ? () => host.openImage?.(block.image, undefined) : undefined,
  });
  const text = (
    <View style={{ flex: 1, gap: theme.blockGap * 0.6 }}>
      <Blocks blocks={block.children} />
    </View>
  );
  const image = media ? <View style={{ width: mediaWidth }}>{media}</View> : null;
  return (
    <View style={{ flexDirection: stacked ? "column" : "row", gap: 14 }}>
      {block.mediaPosition === "start" || stacked ? image : null}
      {text}
      {block.mediaPosition === "end" && !stacked ? image : null}
    </View>
  );
}

function TableView({ block }: { readonly block: Block<"table"> }) {
  return (
    <TableBlock block={block} renderBlocks={(children) => <Blocks blocks={children} compact />} />
  );
}

function ParagraphBlock({ block }: { readonly block: Block<"paragraph"> }) {
  return <ProseRun blocks={[block]} />;
}

type BlockViews = {
  readonly [K in ReaderBlock["type"]]: ComponentType<{ readonly block: Block<K> }>;
};

const BLOCK_VIEWS: BlockViews = {
  paragraph: ParagraphBlock,
  heading: HeadingBlock,
  list: ListBlock,
  quote: QuoteBlock,
  pullQuote: PullQuoteBlock,
  divider: DividerBlock,
  code: CodeBlockView,
  math: MathBlock,
  table: TableView,
  figure: FigureBlock,
  gallery: GalleryBlock,
  video: MediaFileBlock,
  audio: MediaFileBlock,
  embed: EmbedBlockView,
  linkCard: LinkCardBlock,
  callout: CalloutBlock,
  details: DetailsBlock,
  definitionList: DefinitionListBlock,
  mediaText: MediaTextBlock,
  html: HtmlBlock,
};

export function BlockView({ block }: { readonly block: ReaderBlock }): ReactNode {
  // `BlockViews` pairs each type with its component; TypeScript cannot correlate the lookup with
  // `block` across the union, so the entry is widened to the union here.
  const Component = BLOCK_VIEWS[block.type] as ComponentType<{ readonly block: ReaderBlock }>;
  return <Component block={block} />;
}

/** Nested blocks (list items, quotes, callouts, cells). Consecutive paragraphs still share a `Text`. */
export function Blocks({
  blocks,
  compact = false,
  muted = false,
}: {
  readonly blocks: readonly ReaderBlock[];
  readonly compact?: boolean;
  readonly muted?: boolean;
}) {
  const { theme } = useReaderNative();
  const gap = compact ? theme.blockGap * 0.4 : theme.blockGap * 0.7;
  const groups: ReaderBlock[][] = [];
  for (const block of blocks) {
    const last = groups[groups.length - 1];
    if (block.type === "paragraph" && last?.[0]?.type === "paragraph") last.push(block);
    else groups.push([block]);
  }
  return (
    <View style={{ gap, opacity: muted ? 0.82 : 1 }}>
      {keyedByContent(groups).map(({ item: group, key }) =>
        group[0]!.type === "paragraph" ? (
          <ProseRun
            blocks={group as Extract<ReaderSegment, { kind: "prose" }>["blocks"]}
            key={key}
          />
        ) : (
          <BlockView block={group[0]!} key={key} />
        ),
      )}
    </View>
  );
}

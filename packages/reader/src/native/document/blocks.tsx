import { Pressable, ScrollView, Text, View } from "react-native";
import { useState, type ComponentType, type ReactNode } from "react";
import type { ReaderBlock, ReaderInline, ReaderTableCell } from "../../core/document";
import { useReaderNative } from "./context";
import { CodeBlockView } from "./code";
import { EmbedBlockView, LinkCardBlock } from "./embed";
import { Inlines, renderInlines } from "./inline";
import { HtmlBlock, MathBlock } from "./islands";
import { FigureBlock, GalleryBlock, MediaFileBlock } from "./media";
import { imageAspectRatio, useBodyTextStyle } from "./style";
import { DividerBlock, HeadingBlock, PullQuoteBlock } from "./typography";
import { inlinesToText } from "./text";
import type { ReaderSegment } from "./plan";

type Block<T extends ReaderBlock["type"]> = Extract<ReaderBlock, { type: T }>;

/** One native `Text` for consecutive paragraphs, so selection and copy span them. */
export function ProseRun({
  blocks,
}: {
  readonly blocks: Extract<ReaderSegment, { kind: "prose" }>["blocks"];
}) {
  const { theme, host, footnotes } = useReaderNative();
  const base = useBodyTextStyle();
  // The second newline is styled smaller so the gap between paragraphs matches `blockGap`
  // instead of a full blank line.
  const gap = { fontSize: theme.blockGap, lineHeight: theme.blockGap };
  return (
    <Text maxFontSizeMultiplier={theme.maxFontSizeMultiplier} selectable style={base}>
      {blocks.map((block, index) => (
        <Text key={index}>
          {index > 0 ? (
            <>
              {"\n"}
              <Text style={gap}>{"\n"}</Text>
            </>
          ) : null}
          {renderInlines(block.children, { theme, host, footnotes }, `r${index}`)}
        </Text>
      ))}
    </Text>
  );
}

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
      {block.items.map((item, index) => {
        const task = item.checked !== null;
        return (
          <View key={index} style={{ flexDirection: "row" }}>
            <Text
              accessibilityLabel={task ? (item.checked ? "Done" : "To do") : undefined}
              importantForAccessibility={task ? "yes" : "no-hide-descendants"}
              maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
              style={{ ...base, textAlign: "right", width: markerWidth, paddingRight: 8 }}
            >
              {task ? (item.checked ? "☑" : "☐") : marker(block.ordered, block.start, index)}
            </Text>
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
  const [open, setOpen] = useState(block.open);
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
        onPress={() => setOpen((value) => !value)}
        style={{ flexDirection: "row", gap: 8, padding: 12 }}
      >
        <Text style={{ ...base, color: theme.colors.muted }}>{open ? "▾" : "▸"}</Text>
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
      {block.items.map((item, index) => (
        <View key={index} style={{ gap: 4 }}>
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

/** A cell with one paragraph renders as bare text; richer cells render their blocks. */
function cellInlines(cell: ReaderTableCell): readonly ReaderInline[] | null {
  const only = cell.children.length === 1 ? cell.children[0] : undefined;
  return only?.type === "paragraph" ? only.children : null;
}

function TableBlock({ block }: { readonly block: Block<"table"> }) {
  const { theme } = useReaderNative();
  const base = useBodyTextStyle();
  const rows = [
    ...block.head.map((row) => ({ row, head: true })),
    ...block.body.map((row) => ({ row, head: false })),
    ...(block.foot ?? []).map((row) => ({ row, head: false })),
  ];
  const size = theme.fontSize * 0.88;
  return (
    <View>
      {block.caption?.length ? (
        <Text
          maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
          style={{
            ...base,
            color: theme.colors.muted,
            fontSize: theme.fontSize * 0.85,
            marginBottom: 6,
          }}
        >
          <Inlines inlines={block.caption} />
        </Text>
      ) : null}
      <ScrollView
        accessibilityLabel="Table"
        horizontal
        showsHorizontalScrollIndicator
        style={{ borderColor: theme.colors.border, borderRadius: 8, borderWidth: 1 }}
      >
        <View>
          {rows.map(({ row, head }, rowIndex) => (
            <View
              key={rowIndex}
              style={{
                borderTopColor: theme.colors.border,
                borderTopWidth: rowIndex === 0 ? 0 : 1,
                flexDirection: "row",
              }}
            >
              {row.map((cell, cellIndex) => {
                const inlines = cellInlines(cell);
                const header = head || cell.header;
                return (
                  <View
                    key={cellIndex}
                    style={{
                      backgroundColor: header ? theme.colors.codeBackground : undefined,
                      borderLeftColor: theme.colors.border,
                      borderLeftWidth: cellIndex === 0 ? 0 : 1,
                      gap: 4,
                      padding: 10,
                      width: theme.tableColumnWidth * (cell.colSpan ?? 1),
                    }}
                  >
                    {inlines ? (
                      <Text
                        maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
                        selectable
                        style={{
                          ...base,
                          fontFamily: header ? theme.fonts.strong : theme.fonts.body,
                          fontSize: size,
                          lineHeight: Math.round(size * 1.45),
                          textAlign:
                            cell.align === "end"
                              ? "right"
                              : cell.align === "center"
                                ? "center"
                                : "left",
                        }}
                      >
                        <Inlines inlines={inlines} />
                      </Text>
                    ) : (
                      <Blocks blocks={cell.children} compact />
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
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
  table: TableBlock,
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
      {groups.map((group, index) =>
        group[0]!.type === "paragraph" ? (
          <ProseRun
            blocks={group as Extract<ReaderSegment, { kind: "prose" }>["blocks"]}
            key={index}
          />
        ) : (
          <BlockView block={group[0]!} key={index} />
        ),
      )}
    </View>
  );
}

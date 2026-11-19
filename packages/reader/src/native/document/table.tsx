import { ScrollView, Text, View } from "react-native";
import type { ReactNode } from "react";
import type { ReaderBlock, ReaderInline, ReaderTableCell } from "../../core/document";
import { useReaderNative } from "./context";
import { Inlines } from "./inline";
import { useBodyTextStyle } from "./style";
import { inlinesToText } from "./text";
import { tableColumnWidths } from "./table-layout";

type Block<T extends ReaderBlock["type"]> = Extract<ReaderBlock, { type: T }>;

/** A cell with one paragraph renders as bare text; richer cells render their blocks. */
function cellInlines(cell: ReaderTableCell): readonly ReaderInline[] | null {
  const only = cell.children.length === 1 ? cell.children[0] : undefined;
  return only?.type === "paragraph" ? only.children : null;
}

export function TableBlock({
  block,
  renderBlocks,
}: {
  readonly block: Block<"table">;
  readonly renderBlocks: (blocks: readonly ReaderBlock[]) => ReactNode;
}) {
  const { theme } = useReaderNative();
  const base = useBodyTextStyle();
  const rows = [
    ...block.head.map((row) => ({ row, head: true })),
    ...block.body.map((row) => ({ row, head: false })),
    ...(block.foot ?? []).map((row) => ({ row, head: false })),
  ];
  const size = theme.fontSize * 0.88;
  const widths = tableColumnWidths(
    rows.map(({ row }) =>
      row.map((cell) => {
        const inlines = cellInlines(cell);
        return { chars: inlines ? inlinesToText(inlines).length : 0, span: cell.colSpan ?? 1 };
      }),
    ),
    // Minus the 1px frame on each side, so a filled table sits flush inside its border.
    { available: theme.columnWidth - 2, charWidth: size * 0.52 },
  );
  const widthOf = (column: number, span: number) =>
    widths.slice(column, column + span).reduce((sum, width) => sum + width, 0);
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
                const column = row
                  .slice(0, cellIndex)
                  .reduce((sum, previous) => sum + (previous.colSpan ?? 1), 0);
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
                      width: widthOf(column, cell.colSpan ?? 1),
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
                      renderBlocks(cell.children)
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

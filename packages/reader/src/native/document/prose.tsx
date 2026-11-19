import { Text, useWindowDimensions } from "react-native";
import { keyedByContent } from "../../core/keys";
import type { ReaderSegment } from "./plan";
import { useReaderNative } from "./context";
import { renderInlines } from "./inline";
import { useBodyTextStyle } from "./style";

/** One native `Text` for consecutive paragraphs, so selection and copy span them. */
export function ProseRun({
  blocks,
}: {
  readonly blocks: Extract<ReaderSegment, { kind: "prose" }>["blocks"];
}) {
  const { theme, host, footnotes } = useReaderNative();
  const { fontScale } = useWindowDimensions();
  const base = useBodyTextStyle();
  // The second newline is styled smaller so the gap between paragraphs matches `blockGap`
  // instead of a full blank line.
  const gap = { fontSize: theme.blockGap, lineHeight: theme.blockGap };
  return (
    <Text maxFontSizeMultiplier={theme.maxFontSizeMultiplier} selectable style={base}>
      {keyedByContent(blocks).map(({ item: block, key, position: index }) => (
        <Text key={key}>
          {index > 0 ? (
            <>
              {"\n"}
              <Text style={gap}>{"\n"}</Text>
            </>
          ) : null}
          {renderInlines(block.children, { theme, host, footnotes, fontScale }, `r${index}`)}
        </Text>
      ))}
    </Text>
  );
}

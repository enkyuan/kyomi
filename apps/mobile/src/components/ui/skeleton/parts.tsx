import { Fragment, type ReactNode } from "react";
import { View } from "react-native";
import { Skeleton as SkeletonBlock } from "./block";
import type { SkeletonLinesProps } from "./types";

/** Pairs each width with a stable key: the width plus its occurrence count among equal widths. */
function keyedWidths(widths: SkeletonLinesProps["widths"]) {
  const seen = new Map<string, number>();
  return widths.map((width) => {
    const base = String(width);
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return { key: `${base}-${occurrence}`, width };
  });
}

/** A stack of text-line bars: one block per width, `lineHeight` tall, `gap` apart. */
export function SkeletonLines({
  gap = 6,
  lineHeight,
  radius = 4,
  widths,
  ...props
}: SkeletonLinesProps) {
  return (
    <View style={{ gap }}>
      {keyedWidths(widths).map(({ key, width }) => (
        <SkeletonBlock height={lineHeight} key={key} radius={radius} width={width} {...props} />
      ))}
    </View>
  );
}

type SkeletonRepeatProps = {
  readonly children: (index: number) => ReactNode;
  readonly count: number;
};

/** Renders `children` once per index, so a placeholder list is written as one row. */
export function SkeletonRepeat({ children, count }: SkeletonRepeatProps) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => ({ index, key: `row-${index}` })).map(
        ({ index, key }) => (
          <Fragment key={key}>{children(index)}</Fragment>
        ),
      )}
    </>
  );
}

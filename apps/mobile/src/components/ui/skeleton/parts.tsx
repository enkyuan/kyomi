import { Fragment, type ReactNode } from "react";
import { View } from "react-native";
import { Skeleton as SkeletonBlock } from "./block";
import type { SkeletonLinesProps } from "./types";

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
      {widths.map((width, index) => (
        <SkeletonBlock
          height={lineHeight}
          key={`${index}-${width}`}
          radius={radius}
          width={width}
          {...props}
        />
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
      {Array.from({ length: count }, (_, index) => (
        <Fragment key={index}>{children(index)}</Fragment>
      ))}
    </>
  );
}

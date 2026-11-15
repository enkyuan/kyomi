import { type ReactElement } from "react";
import { useWindowDimensions, View } from "react-native";
import { Skeleton } from "@ui/skeleton";
import { feedItemTypography } from "@modules/articles/lib/layout";

export const ESTIMATED_ROW_SIZE = 252;
const MIN_SKELETON_ROWS = 3;
const MAX_SKELETON_ROWS = 12;
const TITLE_LINE_WIDTHS = ["100%", "70%"] as const;
const SUMMARY_LINE_WIDTHS = ["100%", "100%"] as const;

type ListSkeletonProps = {
  ListHeaderComponent?: ReactElement | null;
  tabBarOcclusionHeight: number;
  topContentInset: number;
};

/** Placeholder rows shown while the first page loads, shared by the React Native and native lists. */
export function ListSkeleton({
  ListHeaderComponent,
  tabBarOcclusionHeight,
  topContentInset,
}: ListSkeletonProps) {
  const { height } = useWindowDimensions();

  const { titleLineHeightPx, summaryLineHeightPx, metaFontSizePx } = feedItemTypography;
  const rowCount = height
    ? Math.max(
        MIN_SKELETON_ROWS,
        Math.min(MAX_SKELETON_ROWS, Math.ceil(height / ESTIMATED_ROW_SIZE) + 1),
      )
    : 6;

  return (
    <View style={{ paddingBottom: tabBarOcclusionHeight, paddingTop: topContentInset }}>
      {ListHeaderComponent}
      <Skeleton.Repeat count={rowCount}>
        {(index) => (
          <View className="relative">
            {index > 0 ? (
              <View className="absolute top-0 right-5 left-5 h-px bg-border/70" />
            ) : null}

            <View className="gap-4 px-5 pt-5 pb-2.5">
              <View className="flex-row items-center justify-between gap-4">
                <View className="min-w-0 flex-1 flex-row items-center gap-3">
                  {/* A squircle like the favicon it stands in for. */}
                  <Skeleton height={22} radius={5.5} width={22} />
                  <Skeleton height={Math.max(13, metaFontSizePx)} radius={4} width={112} />
                </View>
                <Skeleton height={Math.max(13, metaFontSizePx)} radius={4} width={64} />
              </View>
              <Skeleton.Lines lineHeight={titleLineHeightPx} widths={TITLE_LINE_WIDTHS} />
            </View>

            <View className="px-5">
              <Skeleton.Lines lineHeight={summaryLineHeightPx} widths={SUMMARY_LINE_WIDTHS} />
            </View>

            <View className="mt-3 flex-row items-center gap-1.5 px-5 pb-4">
              <Skeleton height={20} radius="round" width={64} />
              <Skeleton height={20} radius="round" width={96} />
            </View>
          </View>
        )}
      </Skeleton.Repeat>
    </View>
  );
}

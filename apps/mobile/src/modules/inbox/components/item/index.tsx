import { Pressable, Text, useWindowDimensions, View } from "react-native";
import type { ArticleListItemDto } from "@kyomi/reader/schemas/article";
import { feedItemTypography } from "@modules/inbox/lib/layout";
import { formatInboxTimestamp } from "@modules/inbox/utils/format-timestamp";
import { getFeedSourceLabel } from "@modules/inbox/utils/source-label";
import { Badge } from "../../../../components/ui/badge";
import { ItemToolbar } from "../toolbar/toolbar";
import { FeedFavicon } from "../feed-favicon";

export type ItemProps = {
  readonly item: ArticleListItemDto;
  readonly isFirst: boolean;
  readonly onPress: (item: ArticleListItemDto) => void;
  readonly onPressIn: (item: ArticleListItemDto) => void;
};

export function Item({ item, isFirst, onPress, onPressIn }: ItemProps) {
  const { width } = useWindowDimensions();
  const {
    titleFontSizePx,
    titleLineHeightPx,
    summaryFontSizePx,
    summaryLineHeightPx,
    summaryMaxLines,
    metaFontSizePx,
  } = feedItemTypography;
  const sourceLabel = getFeedSourceLabel(item.link, item.feedTitle);
  const continuationBadgeSize = width <= 360 ? "sm" : "lg";

  return (
    <View className="relative">
      {!isFirst && <View className="absolute top-0 left-0 right-0 h-px bg-border/70" />}

      <Pressable
        accessibilityRole="button"
        onPress={() => onPress(item)}
        onPressIn={() => onPressIn(item)}
      >
        <View className="gap-4 px-5 pt-5 pb-2.5">
          <View className="flex-row items-center justify-between gap-4">
            <View className="min-w-0 flex-1 flex-row items-center gap-3">
              <FeedFavicon
                faviconUrl={item.feedFaviconUrl}
                feedUrl={item.feedUrl ?? item.link}
                siteUrl={item.feedSiteUrl}
                size={22}
                title={item.feedTitle}
              />
              <Text
                className="flex-1 font-medium text-muted-foreground/95"
                numberOfLines={1}
                style={{ fontSize: metaFontSizePx }}
              >
                {sourceLabel}
              </Text>
            </View>
            <Text
              className="shrink-0 font-medium text-muted-foreground/80"
              style={{ fontSize: metaFontSizePx }}
            >
              {formatInboxTimestamp(item.publishedAt)}
            </Text>
          </View>

          <Text
            className="font-semibold text-foreground"
            numberOfLines={2}
            style={{ fontSize: titleFontSizePx, lineHeight: titleLineHeightPx }}
          >
            {item.title}
          </Text>
        </View>

        <Text
          className="px-5 text-muted-foreground/95"
          numberOfLines={summaryMaxLines}
          style={{ fontSize: summaryFontSizePx, lineHeight: summaryLineHeightPx }}
        >
          {item.summary || "No summary available."}
        </Text>
      </Pressable>

      <View className="mt-3 flex-row items-center gap-3 px-5 pb-4">
        {item.lastViewedAt ? (
          <Badge
            accessibilityLabel="Previously opened. Continue reading."
            size={continuationBadgeSize}
            variant="matcha"
          >
            Continue reading
          </Badge>
        ) : null}
        <View className="ml-auto shrink-0">
          <ItemToolbar item={item} />
        </View>
      </View>
    </View>
  );
}

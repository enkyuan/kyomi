import { Alert, Pressable, View } from "react-native";
import { BookmarkIcon, MoreIcon, ShareIcon } from "@/components/icons";
import type { ArticleListItem } from "@modules/inbox/lib/articles";
import { kyomiNativeBrand } from "@kyomi/ui/native/theme";
import { useArticleActions } from "../../hooks/use-article-actions";

const ACTION_ICON_SIZE = 19;

export function ItemToolbar({ item }: { readonly item: ArticleListItem }) {
  const { hideArticle, isUpdating, openSource, reportBrokenArticle, shareArticle, toggleSaved } =
    useArticleActions(item);

  const showMoreActions = () => {
    Alert.alert("Article actions", undefined, [
      { onPress: openSource, text: "Open source" },
      { onPress: hideArticle, style: "destructive", text: "Not interested" },
      { onPress: reportBrokenArticle, text: "Report broken article" },
      { style: "cancel", text: "Cancel" },
    ]);
  };

  const inactiveColor = "#a1a1aa";

  return (
    <View accessibilityRole="toolbar" className="flex-row items-center gap-1">
      <Pressable
        accessibilityLabel={item.isSaved ? "Remove from read later" : "Read later"}
        accessibilityRole="button"
        className="size-12 items-center justify-center rounded-full active:bg-secondary"
        disabled={isUpdating}
        onPress={toggleSaved}
      >
        <BookmarkIcon
          fill={item.isSaved ? kyomiNativeBrand.mizu.color : inactiveColor}
          focused={item.isSaved}
          size={ACTION_ICON_SIZE}
        />
      </Pressable>
      <Pressable
        accessibilityLabel="Share article"
        accessibilityRole="button"
        className="size-12 items-center justify-center rounded-full active:bg-secondary"
        onPress={shareArticle}
      >
        <ShareIcon fill={inactiveColor} size={ACTION_ICON_SIZE} />
      </Pressable>
      <Pressable
        accessibilityLabel="More article actions"
        accessibilityRole="button"
        className="size-12 items-center justify-center rounded-full active:bg-secondary"
        onPress={showMoreActions}
      >
        <MoreIcon fill={inactiveColor} size={ACTION_ICON_SIZE} />
      </Pressable>
    </View>
  );
}

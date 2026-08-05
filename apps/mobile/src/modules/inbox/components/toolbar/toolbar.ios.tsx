import { Host } from "@expo/ui";
import { Button, Menu, RNHostView } from "@expo/ui/swift-ui";
import { accessibilityLabel, frame } from "@expo/ui/swift-ui/modifiers";
import { Pressable, StyleSheet, View } from "react-native";
import { BookmarkIcon, MoreIcon, ShareIcon } from "@/components/icons";
import type { ArticleListItem } from "@modules/inbox/lib/articles";
import { kyomiNativeBrand } from "@kyomi/ui/native/theme";
import { useArticleActions } from "../../hooks/use-article-actions";

const ACTION_ICON_SIZE = 19;
const INACTIVE_COLOR = "#a1a1aa";

export function ItemToolbar({ item }: { readonly item: ArticleListItem }) {
  const { hideArticle, isUpdating, openSource, reportBrokenArticle, shareArticle, toggleSaved } =
    useArticleActions(item);

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
          fill={item.isSaved ? kyomiNativeBrand.mizu.color : INACTIVE_COLOR}
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
        <ShareIcon fill={INACTIVE_COLOR} size={ACTION_ICON_SIZE} />
      </Pressable>
      <View className="size-12 shrink-0">
        <Host ignoreSafeArea="all" style={styles.menuHost}>
          <Menu
            label={
              <RNHostView matchContents>
                <View
                  className="size-12 items-center justify-center rounded-full"
                  pointerEvents="none"
                >
                  <MoreIcon fill={INACTIVE_COLOR} size={ACTION_ICON_SIZE} />
                </View>
              </RNHostView>
            }
            modifiers={[
              frame({ height: 48, width: 48 }),
              accessibilityLabel("More article actions"),
            ]}
          >
            <Button label="Open source" onPress={openSource} systemImage="arrow.up.right" />
            <Button
              label="Not interested"
              onPress={hideArticle}
              role="destructive"
              systemImage="eye.slash"
            />
            <Button
              label="Report broken article"
              onPress={reportBrokenArticle}
              systemImage="exclamationmark.bubble"
            />
          </Menu>
        </Host>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  menuHost: {
    height: 48,
    width: 48,
  },
});

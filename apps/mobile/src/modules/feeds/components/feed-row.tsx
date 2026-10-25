import { MenuView } from "@expo/ui/community/menu";
import { Text, View } from "react-native";
import { DotGridIcon } from "@/components/icons";
import { FONT_STYLES } from "@/theme/fonts";
import { FeedFavicon } from "@modules/articles/components/feed-favicon";
import { HeaderActionButton } from "@ui/header";
import type { Folder, SubscribedFeed } from "../lib/api";

const REMOVE_ACTION = "remove";
const UNFOLLOW_ACTION = "unfollow";
const MOVE_PREFIX = "move:";

type FeedRowProps = {
  readonly feed: SubscribedFeed;
  /** Folders the feed can move to; the one it is in is left out. */
  readonly otherFolders: readonly Folder[];
  readonly onMove: (folderId: string | null) => void;
  readonly onUnfollow: () => void;
};

/** A followed feed in a folder, with a menu of what can be done to it. */
export function FeedRow({ feed, onMove, onUnfollow, otherFolders }: FeedRowProps) {
  const title = feed.customTitle ?? feed.title;

  return (
    <View className="min-h-14 flex-row items-center gap-3 px-5 py-2">
      <FeedFavicon
        faviconUrl={feed.faviconUrl}
        feedUrl={feed.url}
        siteUrl={feed.link}
        size={32}
        title={title}
      />
      <Text
        className="min-w-0 flex-1 text-foreground"
        numberOfLines={1}
        style={FONT_STYLES.bodyMediumMedium}
      >
        {title}
      </Text>
      <MenuView
        actions={[
          {
            id: REMOVE_ACTION,
            image: "folder.badge.minus",
            title: "Remove from folder",
          },
          {
            // A submenu; with no other folder there is nowhere to move to.
            attributes: { disabled: otherFolders.length === 0 },
            id: "move",
            image: "folder",
            subactions: otherFolders.map((folder) => ({
              id: `${MOVE_PREFIX}${folder.id}`,
              title: folder.name,
            })),
            title: "Move to…",
          },
          {
            attributes: { destructive: true },
            id: UNFOLLOW_ACTION,
            image: "minus.circle",
            title: "Unfollow",
          },
        ]}
        onPressAction={({ nativeEvent: { event } }) => {
          if (event === REMOVE_ACTION) onMove(null);
          else if (event === UNFOLLOW_ACTION) onUnfollow();
          else if (event.startsWith(MOVE_PREFIX)) onMove(event.slice(MOVE_PREFIX.length));
        }}
        style={{ height: 38, width: 38 }}
      >
        <HeaderActionButton icon={<DotGridIcon size={18} />} label={`Actions for ${title}`} />
      </MenuView>
    </View>
  );
}

import { Text, useColorScheme, useWindowDimensions, View } from "react-native";
import { EmptyStateIcon } from "@/components/icons/empty-state";
import { TAB_BAR_OCCLUSION_HEIGHT } from "@/components/ui/tab-bar/lib/styles";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { TopTabs } from "@ui/top-tabs";
import { useTopTabsHeader } from "@ui/top-tabs/lib/scroll-context";
import { List } from "@modules/inbox/components/list";
import { usePinnedFolders } from "@modules/inbox/hooks/use-pinned";
import { Badge } from "@/components/ui/badge";

const COMPACT_TITLE_FONT_SIZE = 12.5;
const DEFAULT_TITLE_FONT_SIZE = 16;

const EMPTY_STATES = {
  "My Feed": {
    title: "Add a new feed or check out All to get started",
    description:
      "Follow feeds to start building your reading list. New\nstories will show up here as they're published.",
  },
  All: {
    title: "No articles yet",
    description: "New stories will show up here\nafter feeds publish or refresh.",
  },
} as const;

function InboxEmptyState({ tabName }: { tabName: keyof typeof EMPTY_STATES }) {
  const { description, title } = EMPTY_STATES[tabName];
  const { width } = useWindowDimensions();
  const header = useTopTabsHeader();
  const isCompact = width <= 360;
  const titleFontSize = isCompact ? COMPACT_TITLE_FONT_SIZE : DEFAULT_TITLE_FONT_SIZE;
  const titleLineHeight = Math.round(titleFontSize * 1.35);
  const badgeClassName = isCompact
    ? "relative top-[2px] h-[13px] min-w-0 px-1"
    : "relative top-[3px] h-[18px] min-w-0 px-1.5";
  const badgeTextClassName = isCompact
    ? "text-[10px] leading-[13px]"
    : "text-[13px] leading-[18px]";

  return (
    <View
      className="flex-1 items-center justify-center gap-5 px-5.5"
      style={{ paddingBottom: TAB_BAR_OCCLUSION_HEIGHT, paddingTop: header?.headerHeight ?? 0 }}
    >
      <EmptyStateIcon size={176} />
      <View className="w-full max-w-136 gap-2">
        {tabName === "My Feed" ? (
          <Text
            adjustsFontSizeToFit
            allowFontScaling={false}
            className="w-full self-center text-center font-semibold text-foreground"
            minimumFontScale={0.75}
            numberOfLines={1}
            style={{ fontSize: titleFontSize, lineHeight: titleLineHeight }}
          >
            Add a new feed or check out{" "}
            <Badge
              className={badgeClassName}
              size="sm"
              textClassName={badgeTextClassName}
              variant="secondary"
            >
              All
            </Badge>{" "}
            to get started
          </Text>
        ) : (
          <Text
            adjustsFontSizeToFit
            allowFontScaling={false}
            className="w-full self-center text-center font-semibold text-foreground"
            minimumFontScale={0.8}
            numberOfLines={1}
            style={{ fontSize: titleFontSize, lineHeight: Math.round(titleFontSize * 1.35) }}
          >
            {title}
          </Text>
        )}
        <Text className="w-full self-center max-w-88 text-center text-[13px] leading-5 text-muted-foreground">
          {description}
        </Text>
      </View>
    </View>
  );
}

// No article-list fetching yet — pinned folders render a placeholder until that exists.
function TabPlaceholder({ tabName }: { tabName: string }) {
  const header = useTopTabsHeader();

  return (
    <Text
      style={{ alignSelf: "center", color: "#a1a1aa", marginTop: (header?.headerHeight ?? 0) + 48 }}
    >
      No articles in {tabName} yet
    </Text>
  );
}

export function InboxScreen() {
  const theme = getMobileSurfaceTheme(useColorScheme());
  const pinnedFolders = usePinnedFolders();

  const tabs = [
    <TopTabs.Tab key="My Feed" name="My Feed">
      <InboxEmptyState tabName="My Feed" />
    </TopTabs.Tab>,
    <TopTabs.Tab key="All" name="All">
      <List ListEmptyComponent={<InboxEmptyState tabName="All" />} />
    </TopTabs.Tab>,
    ...pinnedFolders.map((folder) => (
      <TopTabs.Tab key={folder.id} name={folder.name}>
        <TabPlaceholder tabName={folder.name} />
      </TopTabs.Tab>
    )),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopTabs initialTabName="My Feed">{tabs}</TopTabs>
    </View>
  );
}

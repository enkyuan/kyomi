import { Text, useWindowDimensions, View } from "react-native";
import type { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyStateIcon } from "@/components/icons/empty-state";
import { TAB_BAR_OCCLUSION_HEIGHT } from "@/components/ui/tab-bar/lib/styles";
import { TopTabs } from "@ui/top-tabs";
import { usePinnedFolders } from "./use-pinned-folders";

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

function InlineBadge({ children }: { children: ReactNode }) {
  return (
    <Text className="rounded-sm bg-secondary px-1.5 py-0.5 font-medium text-secondary-foreground">
      {children}
    </Text>
  );
}

function InboxEmptyState({ tabName }: { tabName: keyof typeof EMPTY_STATES }) {
  const { description, title } = EMPTY_STATES[tabName];
  const { fontScale, width } = useWindowDimensions();
  const useSingleLineMyFeedTitle = width >= 390 && fontScale <= 1;
  const titleClassName = useSingleLineMyFeedTitle
    ? "w-full self-center max-w-88 text-center text-base font-semibold text-foreground"
    : "w-full self-center max-w-72 text-center text-base font-semibold text-foreground";

  return (
    <View
      className="flex-1 items-center justify-center gap-5 px-5.5"
      style={{ paddingBottom: TAB_BAR_OCCLUSION_HEIGHT }}
    >
      <EmptyStateIcon size={176} />
      <View className="w-full max-w-136 gap-2">
        <Text className={titleClassName}>
          {tabName === "My Feed" ? (
            useSingleLineMyFeedTitle ? (
              <>
                Add a new feed or check out <InlineBadge>All</InlineBadge> to get started
              </>
            ) : (
              <>
                Add a new feed or
                {"\n"}
                check out <InlineBadge>All</InlineBadge> to get started
              </>
            )
          ) : (
            title
          )}
        </Text>
        <Text className="w-full self-center max-w-88 text-center text-[13px] leading-5 text-muted-foreground">
          {description}
        </Text>
      </View>
    </View>
  );
}

// No article-list fetching yet — pinned folders render a placeholder until that exists.
function TabPlaceholder({ tabName }: { tabName: string }) {
  return (
    <Text style={{ alignSelf: "center", color: "#a1a1aa", marginTop: 48 }}>
      No articles in {tabName} yet
    </Text>
  );
}

export function InboxScreen() {
  const pinnedFolders = usePinnedFolders();

  const tabs = [
    <TopTabs.Tab key="My Feed" name="My Feed">
      <InboxEmptyState tabName="My Feed" />
    </TopTabs.Tab>,
    <TopTabs.Tab key="All" name="All">
      <InboxEmptyState tabName="All" />
    </TopTabs.Tab>,
    ...pinnedFolders.map((folder) => (
      <TopTabs.Tab key={folder.id} name={folder.name}>
        <TabPlaceholder tabName={folder.name} />
      </TopTabs.Tab>
    )),
  ];

  return (
    <SafeAreaView className="bg-background" edges={["top"]} style={{ flex: 1 }}>
      <TopTabs initialTabName="My Feed">{tabs}</TopTabs>
    </SafeAreaView>
  );
}

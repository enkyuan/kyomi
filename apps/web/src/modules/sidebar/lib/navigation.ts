import { Calendar3Fill, NewsFill, StarFill, TimeDurationFill } from "@mingcute/react";
import type { ComponentType } from "react";
import type { useNavigate } from "@tanstack/react-router";

export type InboxNavFilter = "today" | "unread" | "saved" | "recent";

export type InboxNavItem = {
  label: string;
  search: { filter: InboxNavFilter };
  icon: ComponentType<{ className?: string }>;
};

const INBOX_NAV: InboxNavItem[] = [
  { label: "Today", search: { filter: "today" }, icon: Calendar3Fill },
  { label: "All Unread", search: { filter: "unread" }, icon: NewsFill },
  { label: "Read Later", search: { filter: "saved" }, icon: StarFill },
  { label: "Recents", search: { filter: "recent" }, icon: TimeDurationFill },
];

const INBOX_NAV_FILTER_KEYS = ["filter"] as const;

function inboxNavBadgeValues(counts: {
  today: number;
  unread: number;
  saved: number;
}): Record<string, number> {
  return {
    Today: counts.today,
    "All Unread": counts.unread,
    "Read Later": counts.saved,
  };
}

export function isInboxNavItemActive(
  isInbox: boolean,
  activeFilter: string | undefined,
  item: InboxNavItem,
  locationSearch: Record<string, unknown>,
): boolean {
  if (!isInbox) {
    return false;
  }
  return INBOX_NAV_FILTER_KEYS.every((key) => {
    const expected = item.search[key];
    const actual = key === "filter" ? activeFilter : locationSearch[key];
    return expected === undefined ? actual === undefined : actual === expected;
  });
}

export type SidebarInboxCounts = {
  all: number;
  today: number;
  unread: number;
  saved: number;
};

export function resolveInboxNavItems(counts: SidebarInboxCounts) {
  const items = INBOX_NAV;
  const badgeValues = inboxNavBadgeValues(counts);
  return { items, badgeValues };
}

export type WorkspaceInboxFilter = "all" | "saved" | "today" | "unread" | "recent";

export function navigateToInbox(
  navigate: ReturnType<typeof useNavigate>,
  filter: WorkspaceInboxFilter,
  feedId?: string,
  folderId?: string,
) {
  return navigate({
    to: "/inbox",
    search: () => ({
      filter,
      search: undefined,
      feedId,
      folderId,
      itemId: undefined,
    }),
  });
}

export type WorkspaceInboxCommandItem = {
  label: string;
  shortcut: string;
  icon: typeof Calendar3Fill;
  action: () => void | Promise<void>;
};

export function buildWorkspaceInboxCommandItems(
  navigate: ReturnType<typeof useNavigate>,
): WorkspaceInboxCommandItem[] {
  return [
    {
      label: "Today",
      shortcut: "G I",
      icon: Calendar3Fill,
      action: () => navigateToInbox(navigate, "today"),
    },
    {
      label: "All Unread",
      shortcut: "G U",
      icon: NewsFill,
      action: () => navigateToInbox(navigate, "unread"),
    },
    {
      label: "Read Later",
      shortcut: "G S",
      icon: StarFill,
      action: () => navigateToInbox(navigate, "saved"),
    },
  ];
}

export type WorkspaceScope =
  | {
      kind: "feed";
      feed: {
        faviconUrl: string | null;
        feedId: string;
        link: string | null;
        title: string;
        url: string;
      };
    }
  | { kind: "folder"; folder: { id: string; name: string } }
  | null;

export function resolveWorkspaceScope(
  scopedFeedId: string | undefined,
  scopedFolderId: string | undefined,
  feedItems: Array<{
    faviconUrl: string | null;
    feedId: string;
    link: string | null;
    title: string;
    url: string;
  }>,
  folderItems: Array<{ id: string; name: string }>,
): WorkspaceScope {
  if (scopedFeedId) {
    const feed = feedItems.find((item) => item.feedId === scopedFeedId);
    if (feed) {
      return { kind: "feed", feed };
    }
  }
  if (scopedFolderId) {
    const folder = folderItems.find((item) => item.id === scopedFolderId);
    if (folder) {
      return { kind: "folder", folder };
    }
  }
  return null;
}

export function workspaceScopeLabel(scope: WorkspaceScope): string {
  if (!scope) {
    return "Inbox";
  }
  if (scope.kind === "feed") {
    return scope.feed.title || scope.feed.url;
  }
  return scope.folder.name;
}

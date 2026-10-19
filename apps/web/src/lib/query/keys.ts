/**
 * Query keys for server state that more than one domain reads or writes, plus the families the hot
 * query cache persists. Domains extend these prefixes for narrower keys; a key that only one domain
 * uses stays in that domain.
 */
export const queryKeys = {
  feeds: {
    all: ["feeds"],
    followed: ["feeds", "followed"],
    followedUnreadCounts: ["feeds", "followed", "unread-counts"],
  },
  folders: {
    all: ["folders"],
  },
  inbox: {
    all: ["inbox"],
    items: ["inbox", "items"],
    itemDetails: ["inbox", "item-detail"],
    itemDetail: (itemId: string | undefined) => ["inbox", "item-detail", itemId] as const,
    viewCount: ["inbox", "view-count"],
    recap: ["inbox", "recap"],
  },
  sidebar: {
    inboxSummary: ["sidebar", "inbox-summary"],
  },
} as const;

import { createServerFn } from "@tanstack/react-start";

export type InboxItemState = "new" | "saved" | "dismissed" | "replied" | "converted";

export type InboxItemSource = "reddit" | "x";

export type InboxSort = "rank" | "recent";

export type InboxItem = {
  id: string;
  sourceKind: InboxItemSource;
  authorHandle: string;
  bodyText: string;
  canonicalUrl: string;
  publishedAt: string;
  intentScore: number;
  painScore: number;
  relevanceScore: number;
  finalRankScore: number;
  recommendation: string;
  state: InboxItemState;
};

type InboxResponse = {
  items: InboxItem[];
  total: number;
  limit: number;
  offset: number;
};

type InboxDetailResponse = {
  item: InboxItem | null;
};

type GetInboxItemsInput = {
  source?: InboxItemSource;
  status?: InboxItemState;
  search?: string;
  sort?: InboxSort;
};

const MOCK_ITEMS: InboxItem[] = [];

function sortItems(items: InboxItem[], sort: InboxSort | undefined) {
  if (sort === "recent") {
    return [...items].sort(
      (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
    );
  }

  return [...items].sort((left, right) => right.finalRankScore - left.finalRankScore);
}

export const getInboxItems = createServerFn({ method: "GET" })
  .inputValidator((input: GetInboxItemsInput) => input)
  .handler(async ({ data }): Promise<InboxResponse> => {
    const normalizedSearch = data.search?.trim().toLowerCase();

    const items = sortItems(
      MOCK_ITEMS.filter((item) => {
        if (data.source && item.sourceKind !== data.source) {
          return false;
        }

        if (data.status && item.state !== data.status) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return [item.authorHandle, item.bodyText, item.sourceKind, item.recommendation].some(
          (value) => value.toLowerCase().includes(normalizedSearch),
        );
      }),
      data.sort,
    );

    return {
      items,
      total: items.length,
      limit: items.length,
      offset: 0,
    };
  });

export const getInboxItemDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { itemId: string }) => input)
  .handler(async ({ data }): Promise<InboxDetailResponse> => {
    const item = MOCK_ITEMS.find((entry) => entry.id === data.itemId);

    if (!item) {
      return {
        item: null,
      };
    }

    return { item };
  });

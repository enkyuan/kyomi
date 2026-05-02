import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { apiJson, buildForwardHeaders } from "@lib/api";
import {
  apiJsonValidated,
  articleCountsSchema,
  articleDetailSchema,
  cursorListResponseSchema,
  extractFullTextResponseSchema,
  type ArticleDetailDto,
  type ExtractFullTextResponseDto,
} from "@lib/api-schemas";
import { z } from "zod";

export type InboxFilter = "today" | "unread" | "saved";

export type InboxItem = {
  id: string;
  title: string;
  summary: string | null;
  link: string;
  publishedAt: string;
  feedTitle: string;
  articleType: "feed" | "clip";
  isRead: boolean;
  isSaved: boolean;
};

type CursorListResponse = z.infer<typeof cursorListResponseSchema>;
type ArticleCountsResponse = z.infer<typeof articleCountsSchema>;

type SidebarInboxCounts = {
  today: number;
  unread: number;
  saved: number;
};

type ScopedUnreadCountResponse = {
  count: number;
};

type InboxResponse = {
  items: InboxItem[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
};

export type InboxDetailResponse = {
  item: ArticleDetailDto | null;
};

type GetInboxItemsInput = {
  filter?: InboxFilter;
  search?: string;
  feedId?: string;
  folderId?: string;
  cursor?: string;
  timezoneOffsetMinutes?: number;
};

function getLocalDayRangeIso(timezoneOffsetMinutes: number) {
  const nowUtcMs = Date.now();
  const nowLocalMs = nowUtcMs - timezoneOffsetMinutes * 60_000;
  const nowLocal = new Date(nowLocalMs);
  const localStartUtcMs =
    Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate(), 0, 0, 0, 0) +
    timezoneOffsetMinutes * 60_000;
  const localEndUtcMs = localStartUtcMs + 24 * 60 * 60 * 1000;

  return {
    start: new Date(localStartUtcMs).toISOString(),
    end: new Date(localEndUtcMs).toISOString(),
  };
}

function mapInboxItem(item: CursorListResponse["items"][number]): InboxItem {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    link: item.link,
    publishedAt: item.publishedAt,
    feedTitle: item.feedTitle,
    articleType: item.articleType,
    isRead: item.isRead,
    isSaved: item.isSaved,
  };
}

function filterItemsBySearch(items: InboxItem[], search?: string) {
  const normalizedSearch = search?.trim().toLowerCase();

  if (!normalizedSearch) {
    return items;
  }

  return items.filter((item) =>
    [item.title, item.summary, item.feedTitle, item.articleType]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(normalizedSearch)),
  );
}

async function fetchInboxList(
  filter: InboxFilter,
  timezoneOffsetMinutes: number,
  cursor: string | undefined,
  headers: Headers,
): Promise<CursorListResponse> {
  return apiJsonValidated(cursorListResponseSchema, () =>
    apiJson<CursorListResponse>(
      buildArticlesUrl(filter, timezoneOffsetMinutes, undefined, undefined, cursor),
      {
        headers: buildForwardHeaders(headers),
      },
    ),
  );
}

function buildArticlesUrl(
  filter: InboxFilter,
  timezoneOffsetMinutes: number,
  feedId?: string,
  folderId?: string,
  cursor?: string,
) {
  const params = new URLSearchParams();
  if (filter === "today") {
    const { start, end } = getLocalDayRangeIso(timezoneOffsetMinutes);
    params.set("published_after", start);
    params.set("published_before", end);
  } else if (filter === "unread") {
    params.set("is_read", "false");
  } else if (filter === "saved") {
    params.set("is_saved", "true");
  }
  if (feedId?.trim()) {
    params.set("feed_id", feedId.trim());
  }
  if (folderId?.trim()) {
    params.set("folder_id", folderId.trim());
  }
  if (cursor?.trim()) {
    params.set("cursor", cursor.trim());
  }
  params.set("limit", "200");
  return `/api/v1/articles?${params.toString()}`;
}

export const getInboxItems = createServerFn({ method: "GET" })
  .inputValidator((input: GetInboxItemsInput) => input)
  .handler(async ({ data }): Promise<InboxResponse> => {
    const headers = getRequestHeaders();
    const filter = data.filter ?? "today";
    const timezoneOffsetMinutes = Number.isFinite(data.timezoneOffsetMinutes)
      ? Number(data.timezoneOffsetMinutes)
      : 0;
    const response =
      data.feedId?.trim() || data.folderId?.trim()
        ? await apiJsonValidated(cursorListResponseSchema, () =>
            apiJson<CursorListResponse>(
              buildArticlesUrl(
                filter,
                timezoneOffsetMinutes,
                data.feedId,
                data.folderId,
                data.cursor,
              ),
              {
                headers: buildForwardHeaders(headers),
              },
            ),
          )
        : await fetchInboxList(filter, timezoneOffsetMinutes, data.cursor, headers);
    const items = filterItemsBySearch(response.items.map(mapInboxItem), data.search);

    return {
      items,
      total: items.length,
      nextCursor: response.next_cursor,
      hasMore: response.has_more,
    };
  });

export const getInboxItemDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { itemId: string }) => input)
  .handler(async ({ data }): Promise<InboxDetailResponse> => {
    const headers = getRequestHeaders();
    const item = await apiJsonValidated(articleDetailSchema, () =>
      apiJson<ArticleDetailDto>(`/api/v1/articles/${data.itemId}`, {
        headers: buildForwardHeaders(headers),
      }),
    );

    return { item };
  });

export const getInboxCounts = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  return apiJsonValidated(articleCountsSchema, () =>
    apiJson<ArticleCountsResponse>("/api/v1/articles/counts", {
      headers: buildForwardHeaders(headers),
    }),
  );
});

export const extractInboxItemFullText = createServerFn({ method: "POST" })
  .inputValidator((input: { itemId: string }) => input)
  .handler(async ({ data }): Promise<ExtractFullTextResponseDto> => {
    const headers = getRequestHeaders();
    const forwarded = buildForwardHeaders(headers);

    return apiJsonValidated(extractFullTextResponseSchema, () =>
      apiJson<ExtractFullTextResponseDto>(`/api/v1/articles/${data.itemId}/extract-full-text`, {
        method: "POST",
        headers: forwarded,
      }),
    );
  });

export const getSidebarInboxCounts = createServerFn({ method: "GET" })
  .inputValidator(
    (input: { timezoneOffsetMinutes?: number; feedId?: string; folderId?: string }) => input,
  )
  .handler(async ({ data }): Promise<SidebarInboxCounts> => {
    const headers = getRequestHeaders();
    const forwarded = buildForwardHeaders(headers);
    const timezoneOffsetMinutes = Number.isFinite(data.timezoneOffsetMinutes)
      ? Number(data.timezoneOffsetMinutes)
      : 0;

    const { start, end } = getLocalDayRangeIso(timezoneOffsetMinutes);
    const params = new URLSearchParams();
    params.set("published_after", start);
    params.set("published_before", end);
    if (data.feedId?.trim()) {
      params.set("feed_id", data.feedId.trim());
    }
    if (data.folderId?.trim()) {
      params.set("folder_id", data.folderId.trim());
    }

    const counts = await apiJsonValidated(articleCountsSchema, () =>
      apiJson<ArticleCountsResponse>(`/api/v1/articles/counts?${params.toString()}`, {
        headers: forwarded,
      }),
    );

    return {
      today: counts.today ?? 0,
      unread: counts.unread,
      saved: counts.saved,
    };
  });

export const getInboxViewCount = createServerFn({ method: "GET" })
  .inputValidator(
    (input: {
      filter: InboxFilter;
      timezoneOffsetMinutes?: number;
      feedId?: string;
      folderId?: string;
    }) => input,
  )
  .handler(async ({ data }): Promise<ScopedUnreadCountResponse> => {
    const headers = getRequestHeaders();
    const forwarded = buildForwardHeaders(headers);
    const timezoneOffsetMinutes = Number.isFinite(data.timezoneOffsetMinutes)
      ? Number(data.timezoneOffsetMinutes)
      : 0;

    const params = new URLSearchParams();
    if (data.filter === "today") {
      const { start, end } = getLocalDayRangeIso(timezoneOffsetMinutes);
      params.set("published_after", start);
      params.set("published_before", end);
    }
    if (data.feedId?.trim()) {
      params.set("feed_id", data.feedId.trim());
    }
    if (data.folderId?.trim()) {
      params.set("folder_id", data.folderId.trim());
    }

    const counts = await apiJsonValidated(articleCountsSchema, () =>
      apiJson<ArticleCountsResponse>(`/api/v1/articles/counts?${params.toString()}`, {
        headers: forwarded,
      }),
    );

    if (data.filter === "today") {
      return { count: counts.today ?? 0 };
    }
    if (data.filter === "saved") {
      return { count: counts.saved };
    }
    return { count: counts.unread };
  });

export const getScopedUnreadCount = createServerFn({ method: "GET" })
  .inputValidator((input: { feedId?: string; folderId?: string }) => input)
  .handler(async ({ data }): Promise<ScopedUnreadCountResponse> => {
    const headers = getRequestHeaders();

    const feedId = data.feedId?.trim();
    if (!feedId && !data.folderId?.trim()) {
      return { count: 0 };
    }

    // Use the per-feed COUNT(*) endpoint instead of fetching a full list
    // and counting .length (which was capped at the query limit).
    if (feedId) {
      const counts = await apiJson<Record<string, number>>(
        `/api/v1/articles/unread-counts?feed_ids=${encodeURIComponent(feedId)}`,
        { headers: buildForwardHeaders(headers) },
      );
      return { count: counts[feedId] ?? 0 };
    }

    // Folder-scoped unread: no dedicated count endpoint yet, fall back to
    // the list query. TODO: add a folder-scoped count endpoint on the API.
    const response = await apiJson<CursorListResponse>(
      buildArticlesUrl("unread", 0, undefined, data.folderId),
      { headers: buildForwardHeaders(headers) },
    );
    return { count: response.items.length };
  });

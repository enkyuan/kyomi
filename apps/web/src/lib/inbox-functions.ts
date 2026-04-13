import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { apiJson, buildForwardHeaders } from "@lib/api";

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

export type ReaderContentResponse = {
  contentStatus: "ready" | "partial" | "failed" | "pending";
  contentSource:
    | "feed_html"
    | "feed_markdown"
    | "feed_summary"
    | "extracted_html"
    | "text_fallback"
    | "link_only";
  bodyKind: "html" | "markdown" | "text" | "fallback";
  title: string | null;
  byline: string | null;
  excerpt: string | null;
  contentHtml: string | null;
  contentMarkdown: string | null;
  contentText: string | null;
  fallbackSummary: string | null;
  fallbackReason: "extraction_failed" | "timeout" | "missing_content" | null;
  siteName: string | null;
  language: string | null;
  publishedTime: string | null;
  notice: string | null;
  extractionErrorCode: string | null;
  extractionErrorMessage: string | null;
  shouldExtract: boolean;
};

type CursorListResponse = {
  items: Array<{
    id: string;
    title: string;
    link: string;
    summary: string | null;
    publishedAt: string;
    feedId: string;
    feedTitle: string;
    isRead: boolean;
    isSaved: boolean;
    articleType: "feed" | "clip";
  }>;
  next_cursor: string | null;
  has_more: boolean;
  total_count: number | null;
};

type ArticleDetailResponse = {
  id: string;
  title: string;
  link: string;
  summary: string | null;
  contentHtml: string | null;
  contentText: string | null;
  contentMarkdown: string | null;
  contentStatus: ReaderContentResponse["contentStatus"];
  contentSource: ReaderContentResponse["contentSource"];
  extractionErrorCode: string | null;
  extractionErrorMessage: string | null;
  publishedAt: string;
  feedId: string;
  feedTitle: string;
  isRead: boolean;
  isSaved: boolean;
  articleType: "feed" | "clip";
  reader: ReaderContentResponse;
};

type ArticleCountsResponse = {
  unread: number;
  saved: number;
};

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

type InboxDetailResponse = {
  item:
    | (InboxItem & {
        contentHtml: string | null;
        contentText: string | null;
        contentMarkdown: string | null;
        contentStatus: ReaderContentResponse["contentStatus"];
        contentSource: ReaderContentResponse["contentSource"];
        extractionErrorCode: string | null;
        extractionErrorMessage: string | null;
        reader: ReaderContentResponse;
      })
    | null;
};

type ExtractFullTextResponse = {
  reader: ReaderContentResponse;
  persisted: boolean;
};

type GetInboxItemsInput = {
  filter?: InboxFilter;
  search?: string;
  feedId?: string;
  folderId?: string;
};

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

async function fetchInboxList(filter: InboxFilter, headers: Headers): Promise<CursorListResponse> {
  if (filter === "saved") {
    return apiJson<CursorListResponse>("/api/v1/articles/views/read-later", {
      headers: buildForwardHeaders(headers),
    });
  }

  if (filter === "unread") {
    return apiJson<CursorListResponse>("/api/v1/articles?is_read=false&limit=100", {
      headers: buildForwardHeaders(headers),
    });
  }

  return apiJson<CursorListResponse>("/api/v1/articles/views/today", {
    headers: buildForwardHeaders(headers),
  });
}

function buildArticlesUrl(filter: InboxFilter, feedId?: string, folderId?: string) {
  const params = new URLSearchParams();
  if (filter === "unread") {
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
  params.set("limit", "100");
  return `/api/v1/articles?${params.toString()}`;
}

export const getInboxItems = createServerFn({ method: "GET" })
  .inputValidator((input: GetInboxItemsInput) => input)
  .handler(async ({ data }): Promise<InboxResponse> => {
    const headers = getRequestHeaders();
    const filter = data.filter ?? "today";
    const response =
      (data.feedId?.trim() || data.folderId?.trim()) && filter !== "today"
        ? await apiJson<CursorListResponse>(buildArticlesUrl(filter, data.feedId, data.folderId), {
            headers: buildForwardHeaders(headers),
          })
        : await fetchInboxList(filter, headers);
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
    const item = await apiJson<ArticleDetailResponse>(`/api/v1/articles/${data.itemId}`, {
      headers: buildForwardHeaders(headers),
    });

    return {
      item: {
        id: item.id,
        title: item.title,
        summary: item.summary,
        contentHtml: item.contentHtml,
        contentText: item.contentText,
        contentMarkdown: item.contentMarkdown,
        contentStatus: item.contentStatus,
        contentSource: item.contentSource,
        extractionErrorCode: item.extractionErrorCode,
        extractionErrorMessage: item.extractionErrorMessage,
        link: item.link,
        publishedAt: item.publishedAt,
        feedTitle: item.feedTitle,
        articleType: item.articleType,
        isRead: item.isRead,
        isSaved: item.isSaved,
        reader: item.reader,
      },
    };
  });

export const getInboxCounts = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  return apiJson<ArticleCountsResponse>("/api/v1/articles/counts", {
    headers: buildForwardHeaders(headers),
  });
});

export const extractInboxItemFullText = createServerFn({ method: "POST" })
  .inputValidator((input: { itemId: string }) => input)
  .handler(async ({ data }): Promise<ExtractFullTextResponse> => {
    const headers = getRequestHeaders();
    const forwarded = buildForwardHeaders(headers);

    return apiJson<ExtractFullTextResponse>(`/api/v1/articles/${data.itemId}/extract-full-text`, {
      method: "POST",
      headers: forwarded,
    });
  });

export const getSidebarInboxCounts = createServerFn({ method: "GET" }).handler(
  async (): Promise<SidebarInboxCounts> => {
    const headers = getRequestHeaders();
    const forwarded = buildForwardHeaders(headers);

    const [todayResponse, unreadResponse, savedResponse] = await Promise.all([
      apiJson<CursorListResponse>("/api/v1/articles/views/today", { headers: forwarded }),
      apiJson<CursorListResponse>("/api/v1/articles?is_read=false&limit=100", {
        headers: forwarded,
      }),
      apiJson<CursorListResponse>("/api/v1/articles/views/read-later", { headers: forwarded }),
    ]);

    return {
      today: todayResponse.items.length,
      unread: unreadResponse.items.length,
      saved: savedResponse.items.length,
    };
  },
);

export const getScopedUnreadCount = createServerFn({ method: "GET" })
  .inputValidator((input: { feedId?: string; folderId?: string }) => input)
  .handler(async ({ data }): Promise<ScopedUnreadCountResponse> => {
    const headers = getRequestHeaders();

    if (!data.feedId?.trim() && !data.folderId?.trim()) {
      return { count: 0 };
    }

    const response = await apiJson<CursorListResponse>(
      buildArticlesUrl("unread", data.feedId, data.folderId),
      {
        headers: buildForwardHeaders(headers),
      },
    );

    return {
      count: response.items.length,
    };
  });

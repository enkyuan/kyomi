import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { apiJson, buildForwardHeaders } from "@lib/api";
import type { ArticleDetailDto, ExtractFullTextResponseDto } from "@lib/schemas";
import {
  buildArticlesUrl,
  buildCountsSearchParams,
  buildCountsUrl,
  buildInboxListUrl,
  type InboxFilter,
} from "./query-urls";

export type { InboxFilter } from "./query-urls";

let inboxSchemaModulePromise:
  | Promise<
      Pick<
        typeof import("@lib/schemas"),
        | "apiJsonValidated"
        | "articleCountsSchema"
        | "articleDetailSchema"
        | "cursorListResponseSchema"
        | "extractFullTextResponseSchema"
      >
    >
  | undefined;

function getInboxSchemaModule() {
  inboxSchemaModulePromise ??= import("@lib/schemas").then((module) => ({
    apiJsonValidated: module.apiJsonValidated,
    articleCountsSchema: module.articleCountsSchema,
    articleDetailSchema: module.articleDetailSchema,
    cursorListResponseSchema: module.cursorListResponseSchema,
    extractFullTextResponseSchema: module.extractFullTextResponseSchema,
  }));
  return inboxSchemaModulePromise;
}

export type InboxItem = {
  id: string;
  title: string;
  summary: string | null;
  link: string;
  publishedAt: string;
  feedFaviconUrl: string | null;
  feedTitle: string;
  articleType: "feed" | "clip";
  isRead: boolean;
  isSaved: boolean;
};

type CursorListResponse = {
  items: InboxItem[];
  next_cursor: string | null;
  has_more: boolean;
  total_count: number | null;
};

type ArticleCountsResponse = {
  all?: number;
  unread: number;
  saved: number;
  today?: number;
};

type SidebarInboxCounts = {
  all: number;
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

export type UpdateInboxItemStateInput = {
  itemId: string;
  isRead?: boolean | null;
  isSaved?: boolean;
};

type GetInboxItemsInput = {
  filter?: InboxFilter;
  search?: string;
  feedId?: string;
  folderId?: string;
  includeRead?: boolean;
  cursor?: string;
  timezoneOffsetMinutes?: number;
};

function mapInboxItem(item: CursorListResponse["items"][number]): InboxItem {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    link: item.link,
    publishedAt: item.publishedAt,
    feedFaviconUrl: item.feedFaviconUrl,
    feedTitle: item.feedTitle,
    articleType: item.articleType,
    isRead: item.isRead,
    isSaved: item.isSaved,
  };
}

async function fetchInboxList({
  filter,
  timezoneOffsetMinutes,
  includeRead,
  search,
  cursor,
  headers,
}: {
  filter: InboxFilter;
  timezoneOffsetMinutes: number;
  includeRead: boolean;
  search: string | undefined;
  cursor: string | undefined;
  headers: Headers;
}): Promise<CursorListResponse> {
  const { apiJsonValidated, cursorListResponseSchema } = await getInboxSchemaModule();
  return apiJsonValidated(cursorListResponseSchema, () =>
    apiJson<CursorListResponse>(
      buildInboxListUrl({ filter, timezoneOffsetMinutes, includeRead, search, cursor }),
      {
        headers: buildForwardHeaders(headers),
      },
    ),
  );
}

export const getInboxItems = createServerFn({ method: "GET" })
  .inputValidator((input: GetInboxItemsInput) => input)
  .handler(async ({ data }): Promise<InboxResponse> => {
    const { apiJsonValidated, cursorListResponseSchema } = await getInboxSchemaModule();
    const headers = getRequestHeaders();
    const filter = data.filter ?? "inbox";
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
                Boolean(data.includeRead),
                data.search,
                data.feedId,
                data.folderId,
                data.cursor,
              ),
              {
                headers: buildForwardHeaders(headers),
              },
            ),
          )
        : await fetchInboxList({
            filter,
            timezoneOffsetMinutes,
            includeRead: Boolean(data.includeRead),
            search: data.search,
            cursor: data.cursor,
            headers,
          });
    const items = response.items.map(mapInboxItem);

    return {
      items,
      total: items.length,
      nextCursor: response.next_cursor ?? null,
      hasMore: response.has_more ?? false,
    };
  });

export const getInboxItemDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { itemId: string }) => input)
  .handler(async ({ data }): Promise<InboxDetailResponse> => {
    const { apiJsonValidated, articleDetailSchema } = await getInboxSchemaModule();
    const headers = getRequestHeaders();
    const item = await apiJsonValidated(articleDetailSchema, () =>
      apiJson<ArticleDetailDto>(`/api/v1/articles/${data.itemId}`, {
        headers: buildForwardHeaders(headers),
      }),
    );

    return { item };
  });

export const updateInboxItemState = createServerFn({ method: "POST" })
  .inputValidator((input: UpdateInboxItemStateInput) => input)
  .handler(async ({ data }): Promise<{ message: string }> => {
    const headers = getRequestHeaders();
    const forwarded = buildForwardHeaders(headers);
    forwarded.set("content-type", "application/json");

    const body: Omit<UpdateInboxItemStateInput, "itemId"> = {};
    if (Object.hasOwn(data, "isRead")) {
      body.isRead = data.isRead;
    }
    if (Object.hasOwn(data, "isSaved")) {
      body.isSaved = data.isSaved;
    }

    return apiJson<{ message: string }>(`/api/v1/articles/${data.itemId}`, {
      method: "PUT",
      headers: forwarded,
      body: JSON.stringify(body),
    });
  });

export const extractInboxItemFullText = createServerFn({ method: "POST" })
  .inputValidator((input: { itemId: string }) => input)
  .handler(async ({ data }): Promise<ExtractFullTextResponseDto> => {
    const { apiJsonValidated, extractFullTextResponseSchema } = await getInboxSchemaModule();
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
    const { apiJsonValidated, articleCountsSchema } = await getInboxSchemaModule();
    const headers = getRequestHeaders();
    const forwarded = buildForwardHeaders(headers);
    const timezoneOffsetMinutes = Number.isFinite(data.timezoneOffsetMinutes)
      ? Number(data.timezoneOffsetMinutes)
      : 0;
    const url = buildCountsUrl(
      buildCountsSearchParams({
        timezoneOffsetMinutes,
        filter: "today",
        feedId: data.feedId,
        folderId: data.folderId,
      }),
    );

    const counts = await apiJsonValidated(articleCountsSchema, () =>
      apiJson<ArticleCountsResponse>(url, { headers: forwarded }),
    );

    return {
      all: counts.all ?? 0,
      today: counts.today ?? 0,
      unread: counts.unread,
      saved: counts.saved,
    };
  });

export const getInboxViewCount = createServerFn({ method: "GET" })
  .inputValidator(
    (input: {
      filter: InboxFilter;
      includeRead?: boolean;
      timezoneOffsetMinutes?: number;
      feedId?: string;
      folderId?: string;
    }) => input,
  )
  .handler(async ({ data }): Promise<ScopedUnreadCountResponse> => {
    const { apiJsonValidated, articleCountsSchema } = await getInboxSchemaModule();
    const headers = getRequestHeaders();
    const forwarded = buildForwardHeaders(headers);
    const timezoneOffsetMinutes = Number.isFinite(data.timezoneOffsetMinutes)
      ? Number(data.timezoneOffsetMinutes)
      : 0;
    const url = buildCountsUrl(
      buildCountsSearchParams({
        timezoneOffsetMinutes,
        filter: data.filter,
        includeRead: data.includeRead,
        feedId: data.feedId,
        folderId: data.folderId,
      }),
    );

    const counts = await apiJsonValidated(articleCountsSchema, () =>
      apiJson<ArticleCountsResponse>(url, { headers: forwarded }),
    );

    if (data.filter === "inbox") {
      return { count: counts.all ?? 0 };
    }
    if (data.filter === "today") {
      return { count: counts.today ?? 0 };
    }
    if (data.filter === "saved") {
      return { count: counts.saved };
    }
    return { count: counts.unread };
  });

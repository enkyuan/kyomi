export type InboxFilter = "all" | "today" | "unread" | "saved" | "recent";
export type LegacyInboxFilter = InboxFilter | "inbox";
export type InboxSort = "newest" | "oldest" | "unread-first";

const INBOX_PAGE_LIMIT = 100;
const DEFAULT_SORT: InboxSort = "newest";

export function normalizeInboxFilter(filter: LegacyInboxFilter | undefined): InboxFilter {
  return filter === "inbox" || filter === undefined ? "all" : filter;
}

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

function setTrimmedQueryParam(params: URLSearchParams, key: string, value: string | undefined) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return;
  }

  params.set(key, trimmedValue);
}

function applyArticleFilterParams(
  params: URLSearchParams,
  filter: LegacyInboxFilter,
  timezoneOffsetMinutes: number,
  includeRead: boolean,
) {
  const normalizedFilter = normalizeInboxFilter(filter);
  if (normalizedFilter === "today") {
    const { start, end } = getLocalDayRangeIso(timezoneOffsetMinutes);
    params.set("published_after", start);
    params.set("published_before", end);
    return;
  }

  if (normalizedFilter === "unread" && !includeRead) {
    params.set("is_read", "false");
    return;
  }

  if (normalizedFilter === "recent") {
    params.set("is_read", "true");
    return;
  }

  if (normalizedFilter === "saved") {
    params.set("is_saved", "true");
  }
}

function applySortParam(params: URLSearchParams, sort: InboxSort | undefined) {
  if (sort && sort !== DEFAULT_SORT) {
    params.set("sort", sort);
  }
}

export function buildArticlesUrl(
  filter: LegacyInboxFilter,
  timezoneOffsetMinutes: number,
  includeRead = false,
  search?: string,
  feedId?: string,
  folderId?: string,
  cursor?: string,
  sort?: InboxSort,
) {
  const params = new URLSearchParams();
  applyArticleFilterParams(params, filter, timezoneOffsetMinutes, includeRead);
  setTrimmedQueryParam(params, "feed_id", feedId);
  setTrimmedQueryParam(params, "folder_id", folderId);
  setTrimmedQueryParam(params, "search", search);
  setTrimmedQueryParam(params, "cursor", cursor);
  applySortParam(params, sort);
  params.set("limit", String(INBOX_PAGE_LIMIT));
  return `/api/v1/articles?${params.toString()}`;
}

export function buildInboxListUrl({
  filter,
  timezoneOffsetMinutes,
  includeRead,
  search,
  cursor,
  sort,
}: {
  filter: LegacyInboxFilter;
  timezoneOffsetMinutes: number;
  includeRead: boolean;
  search: string | undefined;
  cursor: string | undefined;
  sort: InboxSort | undefined;
}) {
  const normalizedFilter = normalizeInboxFilter(filter);
  const params = new URLSearchParams();
  setTrimmedQueryParam(params, "cursor", cursor);
  applySortParam(params, sort);
  params.set("limit", String(INBOX_PAGE_LIMIT));

  if (normalizedFilter === "all") {
    setTrimmedQueryParam(params, "search", search);
    return `/api/v1/articles/views/all?${params.toString()}`;
  }

  if (!search?.trim()) {
    const query = params.toString();
    if (normalizedFilter === "recent") {
      return `/api/v1/articles/views/recently-read?${query}`;
    }
    if (normalizedFilter === "saved") {
      return `/api/v1/articles/views/read-later?${query}`;
    }
  }

  return buildArticlesUrl(
    normalizedFilter,
    timezoneOffsetMinutes,
    includeRead,
    search,
    undefined,
    undefined,
    cursor,
    sort,
  );
}

export function buildCountsSearchParams({
  timezoneOffsetMinutes,
  filter,
  includeRead,
  feedId,
  folderId,
}: {
  timezoneOffsetMinutes?: number;
  filter?: LegacyInboxFilter;
  includeRead?: boolean;
  feedId?: string;
  folderId?: string;
}) {
  const params = new URLSearchParams();
  const normalizedFilter = normalizeInboxFilter(filter);

  if (normalizedFilter === "all") {
    params.set("view", "all");
  }

  if (normalizedFilter === "today") {
    const { start, end } = getLocalDayRangeIso(timezoneOffsetMinutes ?? 0);
    params.set("published_after", start);
    params.set("published_before", end);
  } else if (normalizedFilter === "unread" && !includeRead) {
    params.set("is_read", "false");
  } else if (normalizedFilter === "saved") {
    params.set("is_saved", "true");
  }

  setTrimmedQueryParam(params, "feed_id", feedId);
  setTrimmedQueryParam(params, "folder_id", folderId);

  return params;
}

export function buildCountsUrl(params: URLSearchParams) {
  const query = params.toString();
  return query ? `/api/v1/articles/counts?${query}` : "/api/v1/articles/counts";
}

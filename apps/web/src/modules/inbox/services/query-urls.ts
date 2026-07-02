export type InboxFilter = "my-feed" | "all" | "saved" | "recent";
export type LegacyInboxFilter = InboxFilter | "inbox" | "today" | "unread";
export type InboxSort = "newest" | "oldest";

const INBOX_PAGE_LIMIT = 100;
const DEFAULT_SORT: InboxSort = "newest";

export function normalizeInboxFilter(filter: LegacyInboxFilter | undefined): InboxFilter {
  return filter === "inbox" || filter === "today" || filter === "unread" || filter === undefined
    ? "my-feed"
    : filter;
}

function setTrimmedQueryParam(params: URLSearchParams, key: string, value: string | undefined) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return;
  }

  params.set(key, trimmedValue);
}

function applyArticleFilterParams(params: URLSearchParams, filter: LegacyInboxFilter) {
  const normalizedFilter = normalizeInboxFilter(filter);
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
  _timezoneOffsetMinutes: number,
  _includeRead = false,
  search?: string,
  feedId?: string,
  folderId?: string,
  cursor?: string,
  sort?: InboxSort,
) {
  const params = new URLSearchParams();
  applyArticleFilterParams(params, filter);
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

  if (normalizedFilter === "my-feed") {
    setTrimmedQueryParam(params, "search", search);
    return `/api/v1/articles?${params.toString()}`;
  }

  if (normalizedFilter === "all") {
    setTrimmedQueryParam(params, "search", search);
    return `/api/v1/articles/views/all?${params.toString()}`;
  }

  if (normalizedFilter === "recent") {
    setTrimmedQueryParam(params, "search", search);
    return `/api/v1/articles/views/recently-read?${params.toString()}`;
  }

  if (!search?.trim()) {
    const query = params.toString();
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
  filter,
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

  if (normalizedFilter === "saved") {
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

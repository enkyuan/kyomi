export type InboxFilter = "inbox" | "today" | "unread" | "saved" | "recent";

const INBOX_PAGE_LIMIT = 100;

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
  filter: InboxFilter,
  timezoneOffsetMinutes: number,
  includeRead: boolean,
) {
  if (filter === "today") {
    const { start, end } = getLocalDayRangeIso(timezoneOffsetMinutes);
    params.set("published_after", start);
    params.set("published_before", end);
    return;
  }

  if (filter === "unread" && !includeRead) {
    params.set("is_read", "false");
    return;
  }

  if (filter === "recent") {
    params.set("is_read", "true");
    return;
  }

  if (filter === "saved") {
    params.set("is_saved", "true");
  }
}

export function buildArticlesUrl(
  filter: InboxFilter,
  timezoneOffsetMinutes: number,
  includeRead = false,
  search?: string,
  feedId?: string,
  folderId?: string,
  cursor?: string,
) {
  const params = new URLSearchParams();
  applyArticleFilterParams(params, filter, timezoneOffsetMinutes, includeRead);
  setTrimmedQueryParam(params, "feed_id", feedId);
  setTrimmedQueryParam(params, "folder_id", folderId);
  setTrimmedQueryParam(params, "search", search);
  setTrimmedQueryParam(params, "cursor", cursor);
  params.set("limit", String(INBOX_PAGE_LIMIT));
  return `/api/v1/articles?${params.toString()}`;
}

export function buildInboxListUrl({
  filter,
  timezoneOffsetMinutes,
  includeRead,
  search,
  cursor,
}: {
  filter: InboxFilter;
  timezoneOffsetMinutes: number;
  includeRead: boolean;
  search: string | undefined;
  cursor: string | undefined;
}) {
  if (!search?.trim() && !cursor?.trim()) {
    if (filter === "recent") {
      return "/api/v1/articles/views/recently-read";
    }
    if (filter === "saved") {
      return "/api/v1/articles/views/read-later";
    }
  }

  return buildArticlesUrl(
    filter,
    timezoneOffsetMinutes,
    includeRead,
    search,
    undefined,
    undefined,
    cursor,
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
  filter?: InboxFilter;
  includeRead?: boolean;
  feedId?: string;
  folderId?: string;
}) {
  const params = new URLSearchParams();

  if (filter === "today") {
    const { start, end } = getLocalDayRangeIso(timezoneOffsetMinutes ?? 0);
    params.set("published_after", start);
    params.set("published_before", end);
  } else if (filter === "unread" && !includeRead) {
    params.set("is_read", "false");
  } else if (filter === "saved") {
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

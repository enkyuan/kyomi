export type ParsedListQuery = {
  limit: number;
  cursor: string | undefined;
  feedId: string | undefined;
  folderId: string | undefined;
  source: string;
  isRead: boolean | undefined;
  isSaved: boolean | undefined;
  publishedAfter: Date | undefined;
  publishedBefore: Date | undefined;
};

export function parseOptionalIsoDate(value: unknown): Date | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
}

export function parseArticlesListQuery(query: Record<string, unknown>): ParsedListQuery {
  return {
    limit: Math.min(200, Math.max(1, Number(query.limit ?? 50) || 50)),
    cursor: typeof query.cursor === "string" ? query.cursor : undefined,
    feedId: typeof query.feed_id === "string" ? query.feed_id : undefined,
    folderId: typeof query.folder_id === "string" ? query.folder_id : undefined,
    source: typeof query.source === "string" ? query.source.toLowerCase() : "feeds",
    isRead: query.is_read === "true" ? true : query.is_read === "false" ? false : undefined,
    isSaved: query.is_saved === "true" ? true : undefined,
    publishedAfter: parseOptionalIsoDate(query.published_after),
    publishedBefore: parseOptionalIsoDate(query.published_before),
  };
}

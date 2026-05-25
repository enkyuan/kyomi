export const QUERY_TIMES = {
  countsStale: 30_000,
  countsGc: 2 * 60_000,
  listStale: 2 * 60_000,
  listGc: 10 * 60_000,
  detailStale: 5 * 60_000,
  detailGc: 30 * 60_000,
  staticMetadataStale: 30 * 60_000,
  staticMetadataGc: 24 * 60 * 60_000,
} as const;

export function getTimezoneOffsetMinutes() {
  return typeof window === "undefined" ? 0 : new Date().getTimezoneOffset();
}

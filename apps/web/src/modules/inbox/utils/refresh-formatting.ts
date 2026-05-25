export const BATCH_REFRESH_POLL_MS = 2000;
export const BATCH_REFRESH_GRACE_MS = 12_000;
const ACTIVE_REFRESH_STATUSES = new Set(["queued", "running"]);

export function hasActiveRefreshStatus(items: Array<{ refreshStatus: string }>) {
  return items.some((item) => ACTIVE_REFRESH_STATUSES.has(item.refreshStatus));
}

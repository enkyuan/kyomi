import type { RecentArticle } from "./history";

export type RecentRange = "all" | "today" | "week" | "month";

export const RECENT_RANGES: readonly { readonly id: RecentRange; readonly label: string }[] = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "week", label: "Past week" },
  { id: "month", label: "Past month" },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_WINDOW_MS: Record<Exclude<RecentRange, "all">, number> = {
  month: 30 * DAY_MS,
  today: DAY_MS,
  week: 7 * DAY_MS,
};

export function filterRecentArticles(
  articles: readonly RecentArticle[],
  range: RecentRange,
  now = Date.now(),
): readonly RecentArticle[] {
  if (range === "all") return articles;

  const cutoff = now - RANGE_WINDOW_MS[range];
  return articles.filter((article) => new Date(article.viewedAt).getTime() >= cutoff);
}

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { apiJson, buildForwardHeaders } from "@lib/api";

export type DiscoverFeedResult = {
  id: string | null;
  url: string;
  title: string;
  description: string | null;
  link: string | null;
  isSubscribed: boolean;
};

export type FollowFeedResult = {
  feedId: string;
  subscriptionId: string;
  url: string;
  title: string;
  link: string | null;
  newFeed: boolean;
  newSubscription: boolean;
};

export type FollowedFeed = {
  subscriptionId: string;
  feedId: string;
  url: string;
  title: string;
  customTitle: string | null;
  link: string | null;
  folderId: string | null;
  folderName: string | null;
  subscribedAt: string;
};

type FollowedFeedsResponse = {
  items: FollowedFeed[];
};

function looksLikeFeedUrl(value: string) {
  return /^https?:\/\/\S+$/i.test(value) || /^[\w-]+(\.[\w-]+)+\S*$/i.test(value);
}

function normalizeUrlCandidate(value: string) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

export const searchFeeds = createServerFn({ method: "GET" })
  .inputValidator((input: { query: string }) => input)
  .handler(async ({ data }): Promise<DiscoverFeedResult[]> => {
    const query = data.query.trim();

    if (!query) {
      return [];
    }

    const headers = buildForwardHeaders(getRequestHeaders());

    if (looksLikeFeedUrl(query)) {
      const preview = await apiJson<DiscoverFeedResult>(
        `/api/v1/discover/preview?url=${encodeURIComponent(normalizeUrlCandidate(query))}`,
        { headers },
      );

      return [preview];
    }

    if (query.length < 2) {
      return [];
    }

    return apiJson<DiscoverFeedResult[]>(
      `/api/v1/discover/search?q=${encodeURIComponent(query)}&limit=8`,
      { headers },
    );
  });

export const followFeed = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string }) => input)
  .handler(async ({ data }): Promise<FollowFeedResult> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    headers.set("content-type", "application/json");

    return apiJson<FollowFeedResult>("/api/v1/feeds", {
      method: "POST",
      headers,
      body: JSON.stringify({ url: normalizeUrlCandidate(data.url.trim()) }),
    });
  });

export const listFollowedFeeds = createServerFn({ method: "GET" }).handler(
  async (): Promise<FollowedFeed[]> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    const response = await apiJson<FollowedFeedsResponse>("/api/v1/feeds", {
      headers,
    });
    return response.items;
  },
);

export const unfollowFeed = createServerFn({ method: "POST" })
  .inputValidator((input: { feedId: string }) => input)
  .handler(async ({ data }): Promise<{ message: string }> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    return apiJson<{ message: string }>(`/api/v1/feeds/${encodeURIComponent(data.feedId)}`, {
      method: "DELETE",
      headers,
    });
  });

export const getFollowedFeedUnreadCounts = createServerFn({ method: "POST" })
  .inputValidator((input: { feedIds: string[] }) => input)
  .handler(async ({ data }): Promise<Record<string, number>> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    const uniqueIds = [...new Set(data.feedIds.map((id) => id.trim()).filter(Boolean))];
    if (uniqueIds.length === 0) {
      return {};
    }

    return apiJson<Record<string, number>>(
      `/api/v1/articles/unread-counts?feed_ids=${encodeURIComponent(uniqueIds.join(","))}`,
      { headers },
    );
  });

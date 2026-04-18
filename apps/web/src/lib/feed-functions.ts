import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { apiJson, buildForwardHeaders } from "@lib/api";
import {
  apiJsonValidated,
  discoverFeedResultSchema,
  feedDetailSchema,
  followFeedResultSchema,
  followedFeedsListSchema,
  messageResponseSchema,
} from "@lib/api-schemas";
import { z } from "zod";

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
  faviconUrl: string | null;
  faviconSource: string | null;
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
  faviconUrl: string | null;
  faviconSource: string | null;
  isPinned: boolean;
  pinnedAt: string | null;
  folderId: string | null;
  folderName: string | null;
  subscribedAt: string;
};

export type FeedDetail = {
  id: string;
  url: string;
  title: string;
  customTitle: string | null;
  description: string | null;
  link: string | null;
  faviconUrl: string | null;
  faviconSource: string | null;
  faviconFetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isSubscribed: boolean;
  subscriptionId: string | null;
  subscribedAt: string | null;
  isPinned: boolean;
  pinnedAt: string | null;
  refreshStatus: "idle" | "queued" | "running" | "failed";
  lastRefreshCompletedAt: string | null;
  lastRefreshFailedAt: string | null;
  lastRefreshError: string | null;
  nextRefreshAt: string | null;
};

type FollowedFeedsResponse = {
  items: FollowedFeed[];
};

function looksLikeFeedUrl(value: string) {
  return Boolean(normalizeUrlCandidate(value));
}

function normalizeUrlCandidate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!parsed.hostname) {
      return null;
    }
    if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
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
      const normalizedUrl = normalizeUrlCandidate(query);
      if (!normalizedUrl) {
        return [];
      }

      try {
        const preview = await apiJsonValidated(discoverFeedResultSchema, () =>
          apiJson<DiscoverFeedResult>(
            `/api/v1/discover/preview?url=${encodeURIComponent(normalizedUrl)}`,
            { headers },
          ),
        );

        return [preview];
      } catch {
        return [
          {
            id: null,
            url: normalizedUrl,
            title: normalizedUrl,
            description: "Couldn't preview this feed. Select it to try following directly.",
            link: normalizedUrl,
            isSubscribed: false,
          },
        ];
      }
    }

    if (query.length < 2) {
      return [];
    }

    return apiJsonValidated(z.array(discoverFeedResultSchema), () =>
      apiJson<DiscoverFeedResult[]>(
        `/api/v1/discover/search?q=${encodeURIComponent(query)}&limit=8`,
        { headers },
      ),
    );
  });

export const followFeed = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string }) => input)
  .handler(async ({ data }): Promise<FollowFeedResult> => {
    const normalizedUrl = normalizeUrlCandidate(data.url.trim());
    if (!normalizedUrl) {
      throw new Error("Invalid feed URL");
    }

    const headers = buildForwardHeaders(getRequestHeaders());
    headers.set("content-type", "application/json");

    return apiJsonValidated(followFeedResultSchema, () =>
      apiJson<FollowFeedResult>("/api/v1/feeds", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: normalizedUrl }),
      }),
    );
  });

export const listFollowedFeeds = createServerFn({ method: "GET" }).handler(
  async (): Promise<FollowedFeed[]> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    const response = await apiJsonValidated(followedFeedsListSchema, () =>
      apiJson<FollowedFeedsResponse>("/api/v1/feeds", {
        headers,
      }),
    );
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

export const moveFeedsToFolder = createServerFn({ method: "POST" })
  .inputValidator((input: { feedIds: string[]; folderId: string }) => input)
  .handler(async ({ data }): Promise<{ updatedCount: number }> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    headers.set("content-type", "application/json");
    return apiJson<{ updatedCount: number }>("/api/v1/feeds/folder", {
      method: "PATCH",
      headers,
      body: JSON.stringify(data),
    });
  });

export const refreshFeed = createServerFn({ method: "POST" })
  .inputValidator((input: { feedId: string }) => input)
  .handler(async ({ data }): Promise<{ accepted: boolean; jobId: string; type: string }> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    return apiJson<{ accepted: boolean; jobId: string; type: string }>(
      `/api/v1/feeds/${encodeURIComponent(data.feedId)}/refresh`,
      {
        method: "POST",
        headers,
      },
    );
  });

export const getFeedDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { feedId: string }) => input)
  .handler(async ({ data }): Promise<FeedDetail> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    return apiJsonValidated(feedDetailSchema, () =>
      apiJson<FeedDetail>(`/api/v1/feeds/${encodeURIComponent(data.feedId)}`, {
        method: "GET",
        headers,
      }),
    );
  });

export const updateFeedSubscription = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { feedId: string; customTitle?: string | null; isPinned?: boolean }) => input,
  )
  .handler(async ({ data }): Promise<{ message: string }> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    headers.set("content-type", "application/json");

    return apiJsonValidated(messageResponseSchema, () =>
      apiJson<{ message: string }>(`/api/v1/feeds/${encodeURIComponent(data.feedId)}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          customTitle: data.customTitle,
          isPinned: data.isPinned,
        }),
      }),
    );
  });

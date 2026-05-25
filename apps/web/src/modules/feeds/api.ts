import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { apiJson, buildForwardHeaders } from "@lib/api";
import type {
  DiscoverFeedResultDto,
  FeedDetailDto,
  FollowFeedResultDto,
  FollowedFeedDto,
} from "@lib/schemas";

export type DiscoverFeedResult = DiscoverFeedResultDto;
export type FollowFeedResult = FollowFeedResultDto;
export type FollowedFeed = FollowedFeedDto;
export type FeedDetail = FeedDetailDto;

let feedsSchemaModulePromise:
  | Promise<
      Pick<
        typeof import("@lib/schemas"),
        | "apiJsonValidated"
        | "discoverFeedResultSchema"
        | "feedDetailSchema"
        | "feedRefreshStatusListSchema"
        | "followFeedResultSchema"
        | "followedFeedsListSchema"
        | "messageResponseSchema"
      >
    >
  | undefined;

function getFeedsSchemaModule() {
  feedsSchemaModulePromise ??= import("@lib/schemas").then((module) => ({
    apiJsonValidated: module.apiJsonValidated,
    discoverFeedResultSchema: module.discoverFeedResultSchema,
    feedDetailSchema: module.feedDetailSchema,
    feedRefreshStatusListSchema: module.feedRefreshStatusListSchema,
    followFeedResultSchema: module.followFeedResultSchema,
    followedFeedsListSchema: module.followedFeedsListSchema,
    messageResponseSchema: module.messageResponseSchema,
  }));
  return feedsSchemaModulePromise;
}

type FollowedFeedsResponse = {
  items: FollowedFeedDto[];
};

export type FeedRefreshStatusRow = {
  feedId: string;
  refreshStatus: string;
};

const DISCOVER_PREVIEW_REQUEST_TIMEOUT_MS = 8_000;
const DISCOVER_SEARCH_REQUEST_TIMEOUT_MS = 5_000;

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

function buildRefreshStatusUrl(folderId?: string) {
  const normalizedFolderId = folderId?.trim();
  if (!normalizedFolderId) {
    return "/api/v1/feeds/refresh-status";
  }

  const params = new URLSearchParams({
    folder_id: normalizedFolderId,
  });
  return `/api/v1/feeds/refresh-status?${params.toString()}`;
}

export const searchFeeds = createServerFn({ method: "GET" })
  .inputValidator((input: { query: string }) => input)
  .handler(async ({ data }): Promise<DiscoverFeedResult[]> => {
    const { apiJsonValidated, discoverFeedResultSchema } = await getFeedsSchemaModule();
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
            {
              headers,
              signal: AbortSignal.timeout(DISCOVER_PREVIEW_REQUEST_TIMEOUT_MS),
            },
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
            faviconUrl: null,
            isSubscribed: false,
          },
        ];
      }
    }

    if (query.length < 2) {
      return [];
    }

    try {
      return await apiJsonValidated(discoverFeedResultSchema.array(), () =>
        apiJson<DiscoverFeedResult[]>(
          `/api/v1/discover/search?q=${encodeURIComponent(query)}&limit=8`,
          {
            headers,
            signal: AbortSignal.timeout(DISCOVER_SEARCH_REQUEST_TIMEOUT_MS),
          },
        ),
      );
    } catch {
      return [];
    }
  });

export const followFeed = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string }) => input)
  .handler(async ({ data }): Promise<FollowFeedResult> => {
    const { apiJsonValidated, followFeedResultSchema } = await getFeedsSchemaModule();
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
    const { apiJsonValidated, followedFeedsListSchema } = await getFeedsSchemaModule();
    const headers = buildForwardHeaders(getRequestHeaders());
    const response = await apiJsonValidated(followedFeedsListSchema, () =>
      apiJson<FollowedFeedsResponse>("/api/v1/feeds", {
        headers,
      }),
    );
    return response.items;
  },
);

export const listFeedRefreshStatuses = createServerFn({ method: "GET" })
  .inputValidator((input: { folderId?: string } | void) => input ?? {})
  .handler(async ({ data }): Promise<FeedRefreshStatusRow[]> => {
    const { apiJsonValidated, feedRefreshStatusListSchema } = await getFeedsSchemaModule();
    const headers = buildForwardHeaders(getRequestHeaders());
    const response = await apiJsonValidated(feedRefreshStatusListSchema, () =>
      apiJson<{ items: FeedRefreshStatusRow[] }>(buildRefreshStatusUrl(data.folderId), { headers }),
    );
    return response.items ?? [];
  });

export const unfollowFeed = createServerFn({ method: "POST" })
  .inputValidator((input: { feedId: string }) => input)
  .handler(async ({ data }): Promise<{ message: string }> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    return apiJson<{ message: string }>(`/api/v1/feeds/${encodeURIComponent(data.feedId)}`, {
      method: "DELETE",
      headers,
    });
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

export const refreshBatchFeeds = createServerFn({ method: "POST" })
  .inputValidator((input: { folderId?: string } | void) => input || {})
  .handler(
    async ({ data }): Promise<{ accepted: boolean; count: number; failedCount?: number }> => {
      const headers = buildForwardHeaders(getRequestHeaders());
      headers.set("content-type", "application/json");
      return apiJson<{ accepted: boolean; count: number; failedCount?: number }>(
        `/api/v1/feeds/refresh`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(data),
        },
      );
    },
  );

export const getFeedDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { feedId: string }) => input)
  .handler(async ({ data }): Promise<FeedDetail> => {
    const { apiJsonValidated, feedDetailSchema } = await getFeedsSchemaModule();
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
    const { apiJsonValidated, messageResponseSchema } = await getFeedsSchemaModule();
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

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { apiJson, buildForwardHeaders, resolveApiUrl } from "@lib/api";
import type {
  DiscoverFeedResultDto,
  FollowFeedResultDto,
  FollowedFeedDto,
  OpmlImportAcceptedDto,
  OpmlImportStatusDto,
} from "@lib/schemas/index";

export type DiscoverFeedResult = DiscoverFeedResultDto;
export type FollowFeedResult = FollowFeedResultDto;
export type FollowedFeed = FollowedFeedDto;
export type OpmlImportAccepted = OpmlImportAcceptedDto;
export type OpmlImportStatus = OpmlImportStatusDto;

let feedsSchemaModulePromise:
  | Promise<
      Pick<
        typeof import("@lib/schemas/index"),
        | "apiJsonValidated"
        | "discoverFeedResultSchema"
        | "followFeedResultSchema"
        | "followedFeedsListSchema"
        | "messageResponseSchema"
        | "opmlImportAcceptedSchema"
        | "opmlImportStatusSchema"
      >
    >
  | undefined;

function getFeedsSchemaModule() {
  feedsSchemaModulePromise ??= import("@lib/schemas/index").then((module) => ({
    apiJsonValidated: module.apiJsonValidated,
    discoverFeedResultSchema: module.discoverFeedResultSchema,
    followFeedResultSchema: module.followFeedResultSchema,
    followedFeedsListSchema: module.followedFeedsListSchema,
    messageResponseSchema: module.messageResponseSchema,
    opmlImportAcceptedSchema: module.opmlImportAcceptedSchema,
    opmlImportStatusSchema: module.opmlImportStatusSchema,
  }));
  return feedsSchemaModulePromise;
}

type FollowedFeedsResponse = {
  items: FollowedFeedDto[];
};

type FollowFeedInput = {
  feedId?: string | null;
  url: string;
};

const DISCOVER_PREVIEW_REQUEST_TIMEOUT_MS = 8_000;
const DISCOVER_SEARCH_REQUEST_TIMEOUT_MS = 5_000;
const OPML_IMPORT_START_REQUEST_TIMEOUT_MS = 12_000;
const OPML_IMPORT_STATUS_REQUEST_TIMEOUT_MS = 5_000;
const OPML_EXPORT_REQUEST_TIMEOUT_MS = 12_000;

function getFilenameFromContentDisposition(value: string | null) {
  if (!value) {
    return null;
  }

  const filenameMatch =
    /filename\*=UTF-8''([^;]+)/i.exec(value) ??
    /filename="([^"]+)"/i.exec(value) ??
    /filename=([^;]+)/i.exec(value);
  const filename = filenameMatch?.[1]?.trim();

  if (!filename) {
    return null;
  }

  try {
    return decodeURIComponent(filename);
  } catch {
    return filename;
  }
}

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
  .inputValidator((input: FollowFeedInput) => input)
  .handler(async ({ data }): Promise<FollowFeedResult> => {
    const { apiJsonValidated, followFeedResultSchema } = await getFeedsSchemaModule();
    const feedId = data.feedId?.trim();
    const normalizedUrl = normalizeUrlCandidate(data.url.trim());

    const headers = buildForwardHeaders(getRequestHeaders());

    return apiJsonValidated(followFeedResultSchema, () =>
      feedId
        ? apiJson<FollowFeedResult>(`/api/v1/feeds/${encodeURIComponent(feedId)}/subscribe`, {
            method: "POST",
            headers,
          })
        : (() => {
            if (!normalizedUrl) {
              throw new Error("Invalid feed URL");
            }
            headers.set("content-type", "application/json");
            return apiJson<FollowFeedResult>("/api/v1/feeds", {
              method: "POST",
              headers,
              body: JSON.stringify({ url: normalizedUrl }),
            });
          })(),
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

export const importOpmlFromUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string; filename?: string | null }) => input)
  .handler(async ({ data }): Promise<OpmlImportAccepted> => {
    const { apiJsonValidated, opmlImportAcceptedSchema } = await getFeedsSchemaModule();
    const normalizedUrl = normalizeUrlCandidate(data.url);
    if (!normalizedUrl) {
      throw new Error("Invalid OPML URL");
    }

    const headers = buildForwardHeaders(getRequestHeaders());
    headers.set("content-type", "application/json");

    return apiJsonValidated(opmlImportAcceptedSchema, () =>
      apiJson<OpmlImportAccepted>("/api/v1/opml/imports/from-url", {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: normalizedUrl,
          filename: data.filename?.trim() || undefined,
        }),
        signal: AbortSignal.timeout(OPML_IMPORT_START_REQUEST_TIMEOUT_MS),
      }),
    );
  });

export const getOpmlImportStatus = createServerFn({ method: "GET" })
  .inputValidator((input: { taskId: string }) => input)
  .handler(async ({ data }): Promise<OpmlImportStatus> => {
    const { apiJsonValidated, opmlImportStatusSchema } = await getFeedsSchemaModule();
    const taskId = data.taskId.trim();
    if (!taskId) {
      throw new Error("Missing OPML import task id");
    }

    const headers = buildForwardHeaders(getRequestHeaders());
    return apiJsonValidated(opmlImportStatusSchema, () =>
      apiJson<OpmlImportStatus>(`/api/v1/opml/imports/${encodeURIComponent(taskId)}/status`, {
        headers,
        signal: AbortSignal.timeout(OPML_IMPORT_STATUS_REQUEST_TIMEOUT_MS),
      }),
    );
  });

export const exportOpml = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ filename: string; xml: string }> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    const response = await fetch(resolveApiUrl("/api/v1/opml/export"), {
      headers,
      signal: AbortSignal.timeout(OPML_EXPORT_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error("Unable to export OPML. Try again.");
    }

    return {
      filename:
        getFilenameFromContentDisposition(response.headers.get("content-disposition")) ??
        "kyomi-subscriptions.opml",
      xml: await response.text(),
    };
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

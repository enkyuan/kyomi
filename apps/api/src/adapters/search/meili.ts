import { env } from "@config/env";
import { AppError } from "@shared/errors/app";
import { normalizeLoopbackUrl } from "@shared/net/loopback-url";

export type FeedSearchDocument = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  link: string | null;
  faviconUrl?: string | null;
  sourceKind?: string | null;
  language?: string | null;
  categories?: string[];
  contentType?: string | null;
  qualityScore?: number | null;
  domain?: string | null;
};

function getBaseUrl(): string | null {
  const raw = env.MEILI_URL?.trim();
  return raw ? normalizeLoopbackUrl(raw).replace(/\/+$/, "") : null;
}

function getIndexUid(): string {
  return env.MEILI_INDEX_FEEDS?.trim() || "feeds";
}

function headers(): Record<string, string> {
  return env.MEILI_MASTER_KEY
    ? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.MEILI_MASTER_KEY}`,
      }
    : {
        "Content-Type": "application/json",
      };
}

export function isMeiliConfigured(): boolean {
  return Boolean(getBaseUrl());
}

async function meiliFetch(path: string, init?: RequestInit): Promise<Response> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw new AppError("Meilisearch is not configured", {
      status: 503,
      code: "MEILI_NOT_CONFIGURED",
    });
  }

  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...headers(),
      ...(init?.headers ?? {}),
    },
  });
}

async function doEnsureFeedIndex(): Promise<void> {
  const uid = getIndexUid();
  const createResponse = await meiliFetch("/indexes", {
    method: "POST",
    body: JSON.stringify({
      uid,
      primaryKey: "id",
    }),
  });

  if (!createResponse.ok && createResponse.status !== 409) {
    throw new AppError(`Meilisearch index init failed (${createResponse.status})`, {
      status: 503,
      code: "MEILI_INDEX_INIT_FAILED",
    });
  }

  const settingsResponse = await meiliFetch(`/indexes/${uid}/settings/searchable-attributes`, {
    method: "PUT",
    body: JSON.stringify(["title", "url", "description", "link", "domain"]),
  });

  if (!settingsResponse.ok) {
    throw new AppError(
      `Meilisearch searchable-attributes update failed (${settingsResponse.status})`,
      {
        status: 503,
        code: "MEILI_SETTINGS_UPDATE_FAILED",
      },
    );
  }

  const filterableResponse = await meiliFetch(`/indexes/${uid}/settings/filterable-attributes`, {
    method: "PUT",
    body: JSON.stringify(["sourceKind", "language", "categories", "contentType", "domain"]),
  });

  if (!filterableResponse.ok) {
    throw new AppError(
      `Meilisearch filterable-attributes update failed (${filterableResponse.status})`,
      {
        status: 503,
        code: "MEILI_SETTINGS_UPDATE_FAILED",
      },
    );
  }
}

let feedIndexPromise: Promise<void> | null = null;

async function ensureFeedIndex(): Promise<void> {
  if (!feedIndexPromise) {
    feedIndexPromise = doEnsureFeedIndex().catch((err: unknown) => {
      feedIndexPromise = null;
      throw err;
    });
  }
  return feedIndexPromise;
}

export async function upsertFeedSearchDocuments(documents: FeedSearchDocument[]): Promise<void> {
  if (documents.length === 0) {
    return;
  }
  if (!isMeiliConfigured()) {
    return;
  }
  await ensureFeedIndex();
  const uid = getIndexUid();
  const response = await meiliFetch(`/indexes/${uid}/documents`, {
    method: "POST",
    body: JSON.stringify(documents),
  });
  if (!response.ok) {
    throw new AppError(`Meilisearch upsert failed (${response.status})`, {
      status: 503,
      code: "MEILI_UPSERT_FAILED",
    });
  }
}

export async function upsertFeedSearchDocument(document: FeedSearchDocument): Promise<void> {
  await upsertFeedSearchDocuments([document]);
}

export async function deleteFeedSearchDocument(feedId: string): Promise<void> {
  if (!isMeiliConfigured()) {
    return;
  }
  const uid = getIndexUid();
  const response = await meiliFetch(`/indexes/${uid}/documents/${feedId}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 404) {
    throw new AppError(`Meilisearch delete failed (${response.status})`, {
      status: 503,
      code: "MEILI_DELETE_FAILED",
    });
  }
}

export async function searchFeedSearchDocuments(
  query: string,
  limit: number,
): Promise<FeedSearchDocument[]> {
  if (!isMeiliConfigured()) {
    return [];
  }
  await ensureFeedIndex();
  const uid = getIndexUid();
  const response = await meiliFetch(`/indexes/${uid}/search`, {
    method: "POST",
    body: JSON.stringify({
      q: query,
      limit,
    }),
  });
  if (!response.ok) {
    throw new AppError(`Meilisearch search failed (${response.status})`, {
      status: 503,
      code: "MEILI_SEARCH_FAILED",
    });
  }
  const payload = (await response.json()) as { hits?: FeedSearchDocument[] };
  return Array.isArray(payload.hits) ? payload.hits : [];
}

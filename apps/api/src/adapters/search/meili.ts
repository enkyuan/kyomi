import { env } from "@config/env";

export type FeedSearchDocument = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  link: string | null;
};

function getBaseUrl(): string | null {
  const raw = env.MEILI_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
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
    throw new Error("Meilisearch is not configured");
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
    throw new Error(`Meilisearch index init failed (${createResponse.status})`);
  }

  const settingsResponse = await meiliFetch(`/indexes/${uid}/settings/searchable-attributes`, {
    method: "PUT",
    body: JSON.stringify(["title", "url", "description", "link"]),
  });

  if (!settingsResponse.ok) {
    throw new Error(`Meilisearch searchable-attributes update failed (${settingsResponse.status})`);
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

export async function upsertFeedSearchDocument(document: FeedSearchDocument): Promise<void> {
  if (!isMeiliConfigured()) {
    return;
  }
  await ensureFeedIndex();
  const uid = getIndexUid();
  const response = await meiliFetch(`/indexes/${uid}/documents`, {
    method: "POST",
    body: JSON.stringify([document]),
  });
  if (!response.ok) {
    throw new Error(`Meilisearch upsert failed (${response.status})`);
  }
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
    throw new Error(`Meilisearch delete failed (${response.status})`);
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
    throw new Error(`Meilisearch search failed (${response.status})`);
  }
  const payload = (await response.json()) as { hits?: FeedSearchDocument[] };
  return Array.isArray(payload.hits) ? payload.hits : [];
}

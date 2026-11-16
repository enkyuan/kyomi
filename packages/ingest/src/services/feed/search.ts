import type { FeedMetadata, SearchSyncConfig } from "./types";

type NormalizedSearchSyncConfig = {
  baseUrl: string;
  indexUid: string;
  headers: Record<string, string>;
};

const ensuredIndexTasks = new Map<string, Promise<void>>();

function normalizeSearchSyncConfig(
  config: SearchSyncConfig | undefined,
): NormalizedSearchSyncConfig | null {
  if (!config?.url) {
    return null;
  }

  const baseUrl = config.url.replace(/\/+$/, "");
  const indexUid = config.indexUid?.trim() || "feeds";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.masterKey) {
    headers.Authorization = `Bearer ${config.masterKey}`;
  }

  return { baseUrl, indexUid, headers };
}

async function createFeedSearchIndex(config: NormalizedSearchSyncConfig): Promise<boolean> {
  const createResponse = await fetch(`${config.baseUrl}/indexes`, {
    method: "POST",
    headers: config.headers,
    body: JSON.stringify({ uid: config.indexUid, primaryKey: "id" }),
  }).catch((error: unknown) => {
    console.warn("[syncFeedToSearch] index creation request failed:", error);
    return null;
  });

  if (!createResponse) {
    return false;
  }

  if (createResponse && !createResponse.ok && createResponse.status !== 409) {
    console.warn(`[syncFeedToSearch] index creation returned ${createResponse.status}`);
    return false;
  }

  return true;
}

async function ensureFeedSearchIndex(config: NormalizedSearchSyncConfig): Promise<void> {
  const key = `${config.baseUrl}|${config.indexUid}|${config.headers.Authorization ?? ""}`;
  const existing = ensuredIndexTasks.get(key);
  if (existing) {
    await existing;
    return;
  }

  const task = createFeedSearchIndex(config).then((ok) => {
    if (!ok) {
      ensuredIndexTasks.delete(key);
    }
  });
  ensuredIndexTasks.set(key, task);
  await task;
}

export async function syncFeedToSearch(
  config: SearchSyncConfig | undefined,
  document: FeedMetadata & { id: string },
): Promise<void> {
  const normalizedConfig = normalizeSearchSyncConfig(config);
  if (!normalizedConfig) {
    return;
  }

  await ensureFeedSearchIndex(normalizedConfig);

  const upsertResponse = await fetch(
    `${normalizedConfig.baseUrl}/indexes/${normalizedConfig.indexUid}/documents`,
    {
      method: "POST",
      headers: normalizedConfig.headers,
      body: JSON.stringify([
        {
          id: document.id,
          url: document.canonicalUrl,
          title: document.title,
          description: document.description,
          link: document.link,
          faviconUrl: document.iconUrl,
        },
      ]),
    },
  ).catch((error: unknown) => {
    console.warn("[syncFeedToSearch] document upsert request failed:", error);
    return null;
  });

  if (upsertResponse && !upsertResponse.ok) {
    console.warn(`[syncFeedToSearch] document upsert returned ${upsertResponse.status}`);
  }
}

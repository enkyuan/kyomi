import type { FeedMetadata, SearchSyncConfig } from "./types";

export async function syncFeedToSearch(
  config: SearchSyncConfig | undefined,
  document: FeedMetadata & { id: string },
): Promise<void> {
  if (!config?.url) {
    return;
  }

  const baseUrl = config.url.replace(/\/+$/, "");
  const indexUid = config.indexUid?.trim() || "feeds";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.masterKey) {
    headers.Authorization = `Bearer ${config.masterKey}`;
  }

  const createResponse = await fetch(`${baseUrl}/indexes`, {
    method: "POST",
    headers,
    body: JSON.stringify({ uid: indexUid, primaryKey: "id" }),
  }).catch((error: unknown) => {
    console.warn("[syncFeedToSearch] index creation request failed:", error);
    return null;
  });

  if (createResponse && !createResponse.ok && createResponse.status !== 409) {
    console.warn(`[syncFeedToSearch] index creation returned ${createResponse.status}`);
  }

  const upsertResponse = await fetch(`${baseUrl}/indexes/${indexUid}/documents`, {
    method: "POST",
    headers,
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
  }).catch((error: unknown) => {
    console.warn("[syncFeedToSearch] document upsert request failed:", error);
    return null;
  });

  if (upsertResponse && !upsertResponse.ok) {
    console.warn(`[syncFeedToSearch] document upsert returned ${upsertResponse.status}`);
  }
}

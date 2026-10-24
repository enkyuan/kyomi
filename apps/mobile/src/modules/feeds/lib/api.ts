import { fetchMobileApiJson } from "@/lib/api";

export type DiscoveredFeed = {
  id: string | null;
  url: string;
  title: string;
  description: string | null;
  link: string | null;
  faviconUrl: string | null;
  isSubscribed: boolean;
};

export type Folder = { id: string; name: string };

type FollowedFeed = { feedId: string };

export function previewFeed(url: string, signal?: AbortSignal) {
  return fetchMobileApiJson<DiscoveredFeed>(
    `/api/v1/discover/preview?url=${encodeURIComponent(url)}`,
    {
      signal,
    },
  );
}

export function searchFeeds(query: string, signal?: AbortSignal) {
  return fetchMobileApiJson<DiscoveredFeed[]>(
    `/api/v1/discover/search?q=${encodeURIComponent(query)}&limit=6`,
    { signal },
  );
}

export function listFolders() {
  return fetchMobileApiJson<Folder[]>("/api/v1/folders");
}

/** Follows a discovered feed by id, or any feed by address, then files it in `folderId` if given. */
export async function followFeed(input: { feedId?: string; url: string; folderId?: string }) {
  const followed = input.feedId
    ? await fetchMobileApiJson<FollowedFeed>(
        `/api/v1/feeds/${encodeURIComponent(input.feedId)}/subscribe`,
        {
          method: "POST",
        },
      )
    : await fetchMobileApiJson<FollowedFeed>("/api/v1/feeds", {
        body: JSON.stringify({ url: input.url }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

  if (input.folderId) {
    await fetchMobileApiJson("/api/v1/feeds/folder", {
      body: JSON.stringify({ feedIds: [followed.feedId], folderId: input.folderId }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
  }
  return followed;
}

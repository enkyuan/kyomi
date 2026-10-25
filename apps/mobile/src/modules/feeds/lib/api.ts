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

/** A feed the user follows, as listed by `GET /feeds`. */
export type SubscribedFeed = {
  feedId: string;
  url: string;
  title: string;
  customTitle: string | null;
  link: string | null;
  faviconUrl: string | null;
  folderId: string | null;
  folderName: string | null;
};

export async function listSubscribedFeeds() {
  const { items } = await fetchMobileApiJson<{ items: SubscribedFeed[] }>("/api/v1/feeds");
  return items;
}

export function createFolder(name: string) {
  return fetchMobileApiJson<Folder>("/api/v1/folders", {
    body: JSON.stringify({ name }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

export function renameFolder(input: { folderId: string; name: string }) {
  return fetchMobileApiJson<Folder>(`/api/v1/folders/${encodeURIComponent(input.folderId)}`, {
    body: JSON.stringify({ name: input.name }),
    headers: { "content-type": "application/json" },
    method: "PUT",
  });
}

export function deleteFolder(folderId: string) {
  return fetchMobileApiJson<void>(`/api/v1/folders/${encodeURIComponent(folderId)}`, {
    method: "DELETE",
  });
}

/** Files `feedId` in `folderId`, or takes it out of its folder when `folderId` is null. */
export function moveFeedToFolder(input: { feedId: string; folderId: string | null }) {
  return fetchMobileApiJson("/api/v1/feeds/folder", {
    body: JSON.stringify({ feedIds: [input.feedId], folderId: input.folderId }),
    headers: { "content-type": "application/json" },
    method: "PATCH",
  });
}

export function unfollowFeed(feedId: string) {
  return fetchMobileApiJson(`/api/v1/feeds/${encodeURIComponent(feedId)}`, { method: "DELETE" });
}

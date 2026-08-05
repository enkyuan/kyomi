import { useEffect, useState } from "react";
import { fetchMobileApiJson } from "@/lib/api-client";

type Folder = {
  id: string;
  name: string;
  isPinned: boolean;
  pinnedAt: string | null;
  createdAt: string;
};

// Matches apps/web/src/modules/inbox/page.tsx's pinned-folder ordering:
// pinnedAt DESC NULLS FIRST, then name.
function comparePinned(a: Folder, b: Folder) {
  const aTime = a.pinnedAt ? new Date(a.pinnedAt).getTime() : Number.POSITIVE_INFINITY;
  const bTime = b.pinnedAt ? new Date(b.pinnedAt).getTime() : Number.POSITIVE_INFINITY;
  return bTime - aTime || a.name.localeCompare(b.name);
}

export function usePinnedFolders() {
  const [folders, setFolders] = useState<Folder[]>([]);

  useEffect(() => {
    fetchMobileApiJson<Folder[]>("/api/v1/folders")
      .then((folders) =>
        setFolders(folders.filter((folder) => folder.isPinned).sort(comparePinned)),
      )
      .catch(() => undefined);
  }, []);

  return folders;
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { resolveWorkspaceScope, workspaceScopeLabel } from "../lib/navigation";
import { followedFeedsQueryOptions, foldersQueryOptions } from "../queries/options";
import { useScope } from "@hooks/use-scope";

export function useHeader() {
  const { scopedFeedId, scopedFolderId } = useScope();

  const { data: foldersData } = useQuery(foldersQueryOptions());
  const { data: followedFeedsData } = useQuery(followedFeedsQueryOptions());

  const folderItems = foldersData ?? [];
  const feedItems = followedFeedsData ?? [];
  const scope = resolveWorkspaceScope(scopedFeedId, scopedFolderId, feedItems, folderItems);
  const workspaceLabel = workspaceScopeLabel(scope);

  return {
    scope,
    workspaceLabel,
  };
}

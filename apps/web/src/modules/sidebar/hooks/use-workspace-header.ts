"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  buildWorkspaceInboxCommandItems,
  resolveWorkspaceScope,
  workspaceScopeLabel,
} from "../lib/navigation";
import { followedFeedsQueryOptions, foldersQueryOptions } from "../queries/options";
import type { PlatformState } from "@hooks/use-platform";
import { useInboxScope } from "@hooks/use-inbox-scope";

export function useWorkspaceHeader({ platform }: { platform: PlatformState }) {
  const navigate = useNavigate();
  const { scopedFeedId, scopedFolderId } = useInboxScope();
  const [commandOpen, setCommandOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [manageFeedsOpen, setManageFeedsOpen] = useState(false);

  const foldersQuery = useQuery(foldersQueryOptions());
  const followedFeedsQuery = useQuery(followedFeedsQueryOptions());

  const folderItems = foldersQuery.data ?? [];
  const feedItems = followedFeedsQuery.data ?? [];
  const scope = resolveWorkspaceScope(scopedFeedId, scopedFolderId, feedItems, folderItems);
  const workspaceLabel = workspaceScopeLabel(scope);
  const inboxItems = buildWorkspaceInboxCommandItems(navigate);

  const openNestedDialog = (openDialog: (open: boolean) => void) => {
    setCommandOpen(false);
    queueMicrotask(() => {
      openDialog(true);
    });
  };

  return {
    navigate,
    commandOpen,
    setCommandOpen,
    createFolderOpen,
    setCreateFolderOpen,
    manageFeedsOpen,
    setManageFeedsOpen,
    feedItems,
    folderItems,
    followedFeedsQuery,
    foldersQuery,
    inboxItems,
    platform,
    onCreateFolder: () => {
      openNestedDialog(setCreateFolderOpen);
    },
    onManageFeeds: () => {
      openNestedDialog(setManageFeedsOpen);
    },
    scope,
    scopedFeedId,
    scopedFolderId,
    workspaceLabel,
  };
}

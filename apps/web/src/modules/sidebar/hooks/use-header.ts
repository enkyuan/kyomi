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

export function useHeader({ platform }: { platform: PlatformState }) {
  const navigate = useNavigate();
  const { scopedFeedId, scopedFolderId } = useInboxScope();
  const [commandOpen, setCommandOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [manageFeedsOpen, setManageFeedsOpen] = useState(false);

  const {
    data: foldersData,
    isError: isFoldersError,
    isLoading: isFoldersLoading,
  } = useQuery(foldersQueryOptions());
  const {
    data: followedFeedsData,
    isError: isFollowedFeedsError,
    isLoading: isFollowedFeedsLoading,
  } = useQuery(followedFeedsQueryOptions());

  const folderItems = foldersData ?? [];
  const feedItems = followedFeedsData ?? [];
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
    followedFeedsQuery: { isError: isFollowedFeedsError, isLoading: isFollowedFeedsLoading },
    foldersQuery: { isError: isFoldersError, isLoading: isFoldersLoading },
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

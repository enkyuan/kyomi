"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AddFill, Folder2Fill, Settings1Fill } from "@mingcute/react";
import { useState } from "react";
import { Button } from "@kyomi/ui/button";
import { ScrollArea } from "@kyomi/ui/scroll-area";
import { Separator } from "@kyomi/ui/separator";
import { toastManager } from "@kyomi/ui/toast";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
import { followFeed, moveFeedsToFolder } from "@modules/feeds/api";
import { Dialog as ManageFeedsDialog } from "@modules/feeds/components/manage/dialog";
import { Dialog as CreateFolderDialog } from "@modules/folders/components/create/dialog";
import { updateInboxItemState } from "../../services/api";
import type { InboxOrganizerDto } from "../../services/organizer-schema";
import { inboxOrganizerQueryKey, inboxOrganizerQueryOptions } from "../../queries/options";
import { FolderManagementDialog } from "./folder-management-dialog";
import { FoldersSection } from "./folders-section";
import { OldestSavedItemsSection } from "./oldest-saved-items-section";
import { OrganizerError, OrganizerSkeleton, RailTooltip } from "./section";
import { TopViewedFeedsSection } from "./top-viewed-feeds-section";
import type { OrganizerTopViewedFeed } from "./types";
import { invalidateOrganizerSurface } from "./utils";

export function InboxOrganizerCard() {
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [manageFoldersOpen, setManageFoldersOpen] = useState(false);
  const [manageFeedsOpen, setManageFeedsOpen] = useState(false);
  const queryClient = useQueryClient();
  const organizerQuery = useQuery(inboxOrganizerQueryOptions(5));

  const folders = organizerQuery.data?.folders ?? [];
  const topViewedFeeds = organizerQuery.data?.topViewedFeeds ?? [];
  const oldestSavedItems = organizerQuery.data?.oldestSavedItems ?? [];

  const unsaveMutation = useMutation({
    mutationFn: ({ itemId }: { itemId: string }) =>
      updateInboxItemState({ data: { itemId, isSaved: false } }),
    onMutate: async ({ itemId }) => {
      await queryClient.cancelQueries({ queryKey: inboxOrganizerQueryKey() });
      const snapshot = queryClient.getQueryData<InboxOrganizerDto>(inboxOrganizerQueryKey());
      queryClient.setQueryData<InboxOrganizerDto>(inboxOrganizerQueryKey(), (current) =>
        current
          ? {
              ...current,
              oldestSavedItems: current.oldestSavedItems.filter((item) => item.id !== itemId),
            }
          : current,
      );
      return { snapshot };
    },
    onSuccess: async () => {
      await invalidateOrganizerSurface(queryClient);
    },
    onError: (error, _variables, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(inboxOrganizerQueryKey(), context.snapshot);
      }
      logClientError("inbox.organizer.saved.unsave", error);
      toastManager.add({
        title: "Unable to unsave item",
        description: getUserSafeErrorMessage(error, "Try again in a moment."),
        type: "error",
      });
    },
  });

  const followMutation = useMutation({
    mutationFn: (feed: OrganizerTopViewedFeed) =>
      followFeed({ data: { feedId: feed.feedId, url: feed.url } }),
    onSuccess: async (feed) => {
      await invalidateOrganizerSurface(queryClient);
      toastManager.add({
        title: "Feed followed",
        description: feed.title,
        type: "success",
      });
    },
    onError: (error) => {
      logClientError("inbox.organizer.feed.follow", error);
      toastManager.add({
        title: "Unable to follow feed",
        description: getUserSafeErrorMessage(error, "Try again in a moment."),
        type: "error",
      });
    },
  });

  const moveFeedMutation = useMutation({
    mutationFn: ({ feedId, folderId }: { feedId: string; folderId: string }) =>
      moveFeedsToFolder({ data: { feedIds: [feedId], folderId } }),
    onSuccess: async () => {
      await invalidateOrganizerSurface(queryClient);
    },
    onError: (error) => {
      logClientError("inbox.organizer.feed.move", error);
      toastManager.add({
        title: "Unable to move feed",
        description: getUserSafeErrorMessage(error, "Try again in a moment."),
        type: "error",
      });
    },
  });

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm/5">
      <div className="flex h-14 shrink-0 items-center gap-2 border-border border-b px-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-sm">Organizer</h2>
        </div>
        <RailTooltip label="Create folder">
          <Button
            aria-label="Create folder"
            size="icon-sm"
            variant="ghost"
            onClick={() => setCreateFolderOpen(true)}
          >
            <AddFill />
          </Button>
        </RailTooltip>
        <Button size="sm" variant="outline" onClick={() => setManageFoldersOpen(true)}>
          <Folder2Fill />
          Folders
        </Button>
        <RailTooltip label="Manage feeds">
          <Button
            aria-label="Manage feeds"
            size="icon-sm"
            variant="outline"
            onClick={() => setManageFeedsOpen(true)}
          >
            <Settings1Fill />
          </Button>
        </RailTooltip>
      </div>

      {organizerQuery.isLoading ? (
        <OrganizerSkeleton />
      ) : organizerQuery.isError ? (
        <OrganizerError onRetry={() => void organizerQuery.refetch()} />
      ) : (
        <ScrollArea className="min-h-0 flex-1" scrollFade scrollbarGutter>
          <div className="space-y-7 px-4 py-4">
            <FoldersSection
              folders={folders}
              onCreateFolder={() => setCreateFolderOpen(true)}
              onManageFolders={() => setManageFoldersOpen(true)}
            />
            <Separator />
            <TopViewedFeedsSection
              feeds={topViewedFeeds}
              folders={folders}
              followFeed={(feed) => followMutation.mutate(feed)}
              isFollowingFeed={(feedId) =>
                followMutation.isPending && followMutation.variables?.feedId === feedId
              }
              moveFeed={(feedId, folderId) => moveFeedMutation.mutate({ feedId, folderId })}
              movingFeedId={
                moveFeedMutation.isPending ? (moveFeedMutation.variables?.feedId ?? null) : null
              }
            />
            <Separator />
            <OldestSavedItemsSection
              items={oldestSavedItems}
              onUnsave={(itemId) => unsaveMutation.mutate({ itemId })}
              unsavingItemId={
                unsaveMutation.isPending ? (unsaveMutation.variables?.itemId ?? null) : null
              }
            />
          </div>
        </ScrollArea>
      )}

      <CreateFolderDialog
        hideTrigger
        open={createFolderOpen}
        onOpenChange={(open) => {
          setCreateFolderOpen(open);
          if (!open) {
            void invalidateOrganizerSurface(queryClient);
          }
        }}
      />
      <FolderManagementDialog
        folders={folders}
        open={manageFoldersOpen}
        onOpenChange={setManageFoldersOpen}
        onMutated={() => invalidateOrganizerSurface(queryClient)}
      />
      <ManageFeedsDialog
        open={manageFeedsOpen}
        onOpenChange={(open) => {
          setManageFeedsOpen(open);
          if (!open) {
            void invalidateOrganizerSurface(queryClient);
          }
        }}
      />
    </div>
  );
}

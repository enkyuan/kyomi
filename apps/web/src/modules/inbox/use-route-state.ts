"use client";

import type { InboxPreferences } from "@lib/inbox-preferences";
import type { InboxFilter } from "@modules/inbox/api";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";

function parseSearchFlag(value: string | undefined) {
  if (!value) {
    return false;
  }
  const normalized = value.replaceAll('"', "");
  return normalized === "1" || normalized === "true";
}

export function useInboxRouteState(preferences: InboxPreferences) {
  const { filter, search, feedId, folderId, itemId, showHidden, showRead } = useSearch({
    from: "/inbox/",
  });
  const navigate = useNavigate({ from: "/inbox/" });

  const showHiddenItems = parseSearchFlag(showHidden);
  const showReadItems = parseSearchFlag(showRead);
  const effectiveFilter = (filter ?? preferences.inboxDefaultView) as InboxFilter;
  const supportsReadScopedFilters = effectiveFilter === "today";
  const isReadScopedFilterActive = supportsReadScopedFilters && (showHiddenItems || showReadItems);
  const includeRead = isReadScopedFilterActive;

  const activeScopeLabel = isReadScopedFilterActive
    ? showHiddenItems && !showReadItems
      ? "hidden"
      : "read"
    : undefined;

  useEffect(() => {
    if (filter !== undefined) {
      return;
    }
    void navigate({
      search: (prev) => ({
        ...prev,
        filter: preferences.inboxDefaultView,
      }),
      replace: true,
    });
  }, [filter, navigate, preferences.inboxDefaultView]);

  useEffect(() => {
    if (supportsReadScopedFilters || (!showHiddenItems && !showReadItems)) {
      return;
    }
    void navigate({
      search: (prev) => ({
        ...prev,
        showHidden: undefined,
        showRead: undefined,
      }),
      replace: true,
    });
  }, [navigate, showHiddenItems, showReadItems, supportsReadScopedFilters]);

  return useMemo(
    () => ({
      navigate,
      filter,
      search,
      feedId,
      folderId,
      itemId,
      showHiddenItems,
      showReadItems,
      effectiveFilter,
      supportsReadScopedFilters,
      isReadScopedFilterActive,
      includeRead,
      activeScopeLabel,
    }),
    [
      navigate,
      filter,
      search,
      feedId,
      folderId,
      itemId,
      showHiddenItems,
      showReadItems,
      effectiveFilter,
      supportsReadScopedFilters,
      isReadScopedFilterActive,
      includeRead,
      activeScopeLabel,
    ],
  );
}

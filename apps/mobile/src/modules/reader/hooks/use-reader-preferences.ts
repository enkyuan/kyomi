import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { fetchMobileApiJson } from "@/lib/api";
import { toast } from "@ui/toast";
import {
  MAX_READER_FONT_SIZE_PX,
  MIN_READER_FONT_SIZE_PX,
  clampReaderFontSize,
} from "@kyomi/reader/core";
import type { UserPreferencesDto } from "@kyomi/reader/schemas";
import { mobileReaderLayout } from "../lib/layout";

type ReaderPreferences = Pick<UserPreferencesDto, "fontSizePx" | "rememberPosition">;

const preferencesQueryKey = ["me", "preferences"] as const;

/** The reader preferences the mobile reader reads, from the same endpoint the web settings use. */
export function useReaderPreferences() {
  const query = useQuery({
    queryFn: ({ signal }) =>
      fetchMobileApiJson<ReaderPreferences>("/api/v1/me/preferences", { signal }),
    queryKey: preferencesQueryKey,
    // A failed request must not hold the article back; the API default (on) applies.
    retry: false,
    // A focus or remount refetch resolving with the old size must not undo a choice just made.
    staleTime: 5 * 60_000,
  });

  return {
    /** Body text size in points, until the preferences are known the reader's own default. */
    fontSizePx: clampReaderFontSize(query.data?.fontSizePx ?? mobileReaderLayout.body.fontSizePx),
    /** Whether the preferences are known, or can no longer be waited for. */
    isSettled: query.status !== "pending" || query.fetchStatus === "paused",
    rememberPosition: query.data?.rememberPosition ?? true,
  };
}

export const READER_FONT_SIZE_RANGE = {
  max: MAX_READER_FONT_SIZE_PX,
  min: MIN_READER_FONT_SIZE_PX,
} as const;

type SaveFontSize = {
  readonly fontSizePx: number;
  /** What the cache held before the choice, put back if the request fails. */
  readonly previous: ReaderPreferences | undefined;
};

async function saveFontSize({ fontSizePx }: SaveFontSize) {
  return fetchMobileApiJson<ReaderPreferences>("/api/v1/me/preferences", {
    body: JSON.stringify({ fontSizePx }),
    headers: { "content-type": "application/json" },
    method: "PATCH",
  });
}

/**
 * The reader's text size, driven by the bar's slider. One value path: the slider's steps set a
 * preview that the body renders at once, and its release writes the size into the preferences cache
 * in the same tick the preview is dropped, so the body never falls back to the old saved size while
 * the request is in flight. The request is not awaited: a failure restores the previous size.
 */
export function useReaderFontSize() {
  const queryClient = useQueryClient();
  const { fontSizePx: savedSize } = useReaderPreferences();
  const [preview, setPreview] = useState<number | null>(null);

  const { mutate } = useMutation({
    mutationFn: saveFontSize,
    onError: (_error, { previous }) => {
      if (previous) queryClient.setQueryData<ReaderPreferences>(preferencesQueryKey, previous);
      toast.error("Couldn't save text size");
    },
    onSuccess: (saved) => {
      // Only fills a cache that was still empty; a known one already holds the chosen size.
      queryClient.setQueryData<ReaderPreferences>(
        preferencesQueryKey,
        (current) => current ?? saved,
      );
    },
  });

  const onFontSize = useCallback(
    (size: number, committed: boolean) => {
      const next = clampReaderFontSize(size);
      if (!committed) {
        setPreview(next);
        return;
      }
      const previous = queryClient.getQueryData<ReaderPreferences>(preferencesQueryKey);
      if (previous) {
        // The write is synchronous so the preview can be dropped without a frame at the old size,
        // and a refetch still in flight must not overwrite the choice with the old one.
        void queryClient.cancelQueries({ queryKey: preferencesQueryKey });
        queryClient.setQueryData<ReaderPreferences>(preferencesQueryKey, {
          ...previous,
          fontSizePx: next,
        });
        setPreview(null);
        mutate({ fontSizePx: next, previous });
        return;
      }
      // Nothing cached to hold the size yet (preferences still loading): the preview stays until
      // the request settles. Only this path clears it there, so a drag begun while an earlier
      // request is still in flight is never cut short.
      setPreview(next);
      mutate({ fontSizePx: next, previous }, { onSettled: () => setPreview(null) });
    },
    [mutate, queryClient],
  );

  return { fontSizePx: preview ?? savedSize, onFontSize };
}

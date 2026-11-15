import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { useEffect, useState } from "react";
import { mobileApiErrorMessage } from "@/lib/api";
import { articleListQueryKeys } from "@modules/articles/queries/keys";
import { foldersQueryKey, subscribedFeedsQueryKey } from "@modules/feeds/queries/keys";
import { getOpmlImportState, isOpmlImportFinished, startOpmlImport } from "../lib/api";

/** An OPML file is a list of links; anything much larger than this is not one. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const POLL_INTERVAL_MS = 1000;

/**
 * Picks an OPML file, queues its import, and follows the job until it stops. The feeds and folders it
 * adds are fetched again once it has, so the Sources sheet and the inbox show them.
 */
export function useOpmlImport() {
  const queryClient = useQueryClient();
  const [taskId, setTaskId] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: async () => {
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: "*/*",
      });
      if (picked.canceled) return null;

      const asset = picked.assets[0];
      if (!asset) return null;
      if (asset.size !== undefined && asset.size > MAX_FILE_BYTES) {
        throw new Error("That file is too large to be an OPML export.");
      }
      const xml = await (await fetch(asset.uri)).text();
      return await startOpmlImport({ filename: asset.name, xml });
    },
    onSuccess: (queued) => {
      if (queued) setTaskId(queued.taskId);
    },
  });

  const state = useQuery({
    enabled: taskId !== null,
    queryFn: () => getOpmlImportState(taskId ?? ""),
    queryKey: ["opml", "import", taskId],
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && isOpmlImportFinished(status) ? false : POLL_INTERVAL_MS;
    },
  });

  const finished = state.data ? isOpmlImportFinished(state.data.status) : false;
  useEffect(() => {
    if (!finished) return;
    void queryClient.invalidateQueries({ queryKey: foldersQueryKey });
    void queryClient.invalidateQueries({ queryKey: subscribedFeedsQueryKey });
    for (const queryKey of articleListQueryKeys) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }, [finished, queryClient]);

  function reset() {
    setTaskId(null);
    start.reset();
  }

  const error = start.error ?? state.error;
  const phase = error
    ? "error"
    : start.isPending
      ? "starting"
      : taskId === null
        ? "idle"
        : state.data && finished
          ? state.data.status === "completed"
            ? "done"
            : "stopped"
          : "running";

  return {
    errorMessage: error ? mobileApiErrorMessage(error) : null,
    importState: state.data ?? null,
    phase,
    reset,
    start: () => start.mutate(),
  } as const;
}

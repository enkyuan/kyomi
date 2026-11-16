import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { useEffect, useState } from "react";
import { mobileApiErrorMessage } from "@/lib/api";
import { articleListQueryKeys } from "@modules/articles/queries/keys";
import { foldersQueryKey, subscribedFeedsQueryKey } from "@modules/feeds/queries/keys";
import {
  getOpmlImportState,
  isOpmlImportFinished,
  startOpmlImport,
  type OpmlImportState,
} from "../lib/api";

/** An OPML file is a list of links; anything much larger than this is not one. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const POLL_INTERVAL_MS = 1000;

const OPML_IMPORT_QUERY_KEY = ["opml", "import"] as const;

/** Opens the file picker and queues what it returns; `null` when nothing was picked. */
async function pickAndQueueImport() {
  const picked = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: "*/*",
  });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) return null;
  if (asset.size !== undefined && asset.size > MAX_FILE_BYTES) {
    throw new Error("That file is too large to be an OPML export.");
  }
  const response = await fetch(asset.uri);
  if (!response.ok) throw new Error("That file could not be read.");
  return await startOpmlImport({ filename: asset.name, xml: await response.text() });
}

type ImportPhase = "error" | "starting" | "idle" | "done" | "stopped" | "running";

function importPhase(input: {
  error: boolean;
  pending: boolean;
  state: OpmlImportState | undefined;
  taskId: string | null;
}): ImportPhase {
  if (input.error) return "error";
  if (input.pending) return "starting";
  if (input.taskId === null) return "idle";
  if (!input.state || !isOpmlImportFinished(input.state.status)) return "running";
  return input.state.status === "completed" ? "done" : "stopped";
}

/**
 * Picks an OPML file, queues its import, and follows the job until it stops. The feeds and folders it
 * adds are fetched again once it has, so the Sources sheet and the inbox show them.
 */
export function useOpmlImport() {
  const queryClient = useQueryClient();
  const [taskId, setTaskId] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: pickAndQueueImport,
    // A new import supersedes the state of the last one.
    onSuccess: (queued) => {
      void queryClient.invalidateQueries({ queryKey: OPML_IMPORT_QUERY_KEY });
      if (queued) setTaskId(queued.taskId);
    },
  });

  const state = useQuery({
    enabled: taskId !== null,
    queryFn: () => getOpmlImportState(taskId ?? ""),
    queryKey: [...OPML_IMPORT_QUERY_KEY, taskId],
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
  const phase = importPhase({
    error: error !== null,
    pending: start.isPending,
    state: state.data,
    taskId,
  });

  return {
    errorMessage: error ? mobileApiErrorMessage(error) : null,
    importState: state.data ?? null,
    phase,
    reset,
    start: () => start.mutate(),
  } as const;
}

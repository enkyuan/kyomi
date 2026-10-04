import { listFolders } from "@modules/folders/lib/api";
import { QUERY_TIMES } from "@lib/query/policies";
import { queryKeys } from "@lib/query/keys";

export function foldersQueryOptions() {
  return {
    queryKey: queryKeys.folders.all,
    queryFn: () => listFolders(),
    staleTime: QUERY_TIMES.staticMetadataStale,
    gcTime: QUERY_TIMES.staticMetadataGc,
  } as const;
}

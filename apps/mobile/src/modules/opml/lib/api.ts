import { fetchMobileApiJson } from "@/lib/api";

export type OpmlImportStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

export type OpmlImportFailure = { url: string; code: string; message: string };

export type OpmlImportSummary = {
  totalUrls: number;
  completed: number;
  subscribed: number;
  alreadySubscribed: number;
  failed: number;
  cancelled: number;
  failures: OpmlImportFailure[];
};

export type OpmlImportState = {
  taskId: string;
  status: OpmlImportStatus;
  filename: string;
  message: string | null;
  summary: OpmlImportSummary;
};

/** Whether the job has stopped, for good or ill; until then it is still being worked on. */
export function isOpmlImportFinished(status: OpmlImportStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

/**
 * Queues an import of an OPML document and returns the job's id. The raw endpoint takes the file
 * as the request body, so it is not held to the JSON endpoint's size limit.
 */
export function startOpmlImport(input: { xml: string; filename: string }) {
  return fetchMobileApiJson<{ taskId: string }>("/api/v1/opml/imports/raw", {
    body: input.xml,
    headers: {
      "content-type": "application/xml",
      // A header carries ASCII only; the name is for the import's history, not for the file.
      "x-opml-filename": input.filename.replace(/[^\x20-\x7e]/g, "_"),
    },
    method: "POST",
  });
}

export function getOpmlImportState(taskId: string) {
  return fetchMobileApiJson<OpmlImportState>(
    `/api/v1/opml/imports/${encodeURIComponent(taskId)}/status`,
  );
}

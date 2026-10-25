import { fetchMobileApiJson } from "@/lib/api";
import { createAppStorage } from "@lib/storage";
import { createProgressBuffer } from "./progress-buffer";
import { createProgressSync, type ReadingProgressResult } from "./progress-sync";

/** The app's reading progress writer: sends to the API and buffers what cannot be sent. */
export const readingProgressSync = createProgressSync({
  buffer: createProgressBuffer(createAppStorage("reading-progress")),
  send: async (articleId, body) => {
    const response = await fetchMobileApiJson<{ readingProgress: ReadingProgressResult }>(
      `/api/v1/articles/${encodeURIComponent(articleId)}/progress`,
      {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method: "PUT",
      },
    );
    return response.readingProgress;
  },
});

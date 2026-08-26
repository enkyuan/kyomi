import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { apiJson, buildForwardHeaders } from "@lib/api";
import { fetchValidatedJson } from "@kyomi/reader/schemas";
import { inboxRecapSchema, type InboxRecapDto } from "./schema";

export const getInboxRecap = createServerFn({ method: "GET" })
  .validator((input: { limit?: number }) => input)
  .handler(async ({ data }): Promise<InboxRecapDto> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    const search = new URLSearchParams();
    if (data.limit !== undefined) {
      search.set("limit", String(data.limit));
    }
    const query = search.toString();
    const suffix = query ? `?${query}` : "";

    return fetchValidatedJson(inboxRecapSchema, () =>
      apiJson<InboxRecapDto>(`/api/v1/inbox/recap${suffix}`, {
        headers,
      }),
    );
  });

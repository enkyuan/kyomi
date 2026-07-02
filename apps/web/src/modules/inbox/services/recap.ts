import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { apiJson, buildForwardHeaders } from "@lib/api";
import { apiJsonValidated } from "@lib/schemas";
import { inboxRecapSchema, type InboxRecapDto } from "./recap-schema";

export const getInboxRecap = createServerFn({ method: "GET" })
  .inputValidator((input: { limit?: number }) => input)
  .handler(async ({ data }): Promise<InboxRecapDto> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    const search = new URLSearchParams();
    if (data.limit !== undefined) {
      search.set("limit", String(data.limit));
    }
    const query = search.toString();
    const suffix = query ? `?${query}` : "";

    return apiJsonValidated(inboxRecapSchema, () =>
      apiJson<InboxRecapDto>(`/api/v1/inbox/recap${suffix}`, {
        headers,
      }),
    );
  });

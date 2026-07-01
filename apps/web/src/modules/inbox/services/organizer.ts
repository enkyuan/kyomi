import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { apiJson, buildForwardHeaders } from "@lib/api";
import { apiJsonValidated } from "@lib/schemas";
import { inboxOrganizerSchema, type InboxOrganizerDto } from "./organizer-schema";

export const getInboxOrganizer = createServerFn({ method: "GET" })
  .inputValidator((input: { limit?: number }) => input)
  .handler(async ({ data }): Promise<InboxOrganizerDto> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    const search = new URLSearchParams();
    if (data.limit !== undefined) {
      search.set("limit", String(data.limit));
    }
    const query = search.toString();
    const suffix = query ? `?${query}` : "";

    return apiJsonValidated(inboxOrganizerSchema, () =>
      apiJson<InboxOrganizerDto>(`/api/v1/inbox/organizer${suffix}`, {
        headers,
      }),
    );
  });

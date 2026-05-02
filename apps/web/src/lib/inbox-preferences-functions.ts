import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { apiJson, buildForwardHeaders } from "@lib/api";
import {
  apiJsonValidated,
  inboxPreferencesSchema,
  type InboxPreferencesDto,
} from "@lib/api-schemas";

export const getInboxPreferences = createServerFn({ method: "GET" }).handler(
  async (): Promise<InboxPreferencesDto> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    return apiJsonValidated(inboxPreferencesSchema, () =>
      apiJson<InboxPreferencesDto>("/api/v1/me/preferences", { headers }),
    );
  },
);

export const updateInboxPreferences = createServerFn({ method: "POST" })
  .inputValidator((input: Partial<InboxPreferencesDto>) => input)
  .handler(async ({ data }): Promise<InboxPreferencesDto> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    headers.set("content-type", "application/json");

    return apiJsonValidated(inboxPreferencesSchema, () =>
      apiJson<InboxPreferencesDto>("/api/v1/me/preferences", {
        method: "PATCH",
        headers,
        body: JSON.stringify(data),
      }),
    );
  });

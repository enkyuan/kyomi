import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { apiJson, buildForwardHeaders } from "@lib/api";
import {
  apiJsonValidated,
  readerPreferencesSchema,
  type ReaderPreferencesDto,
} from "@lib/api-schemas";

export const getReaderPreferences = createServerFn({ method: "GET" }).handler(
  async (): Promise<ReaderPreferencesDto> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    return apiJsonValidated(readerPreferencesSchema, () =>
      apiJson<ReaderPreferencesDto>("/api/v1/me/preferences", { headers }),
    );
  },
);

export const updateReaderPreferences = createServerFn({ method: "POST" })
  .inputValidator((input: Partial<ReaderPreferencesDto>) => input)
  .handler(async ({ data }): Promise<ReaderPreferencesDto> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    headers.set("content-type", "application/json");

    return apiJsonValidated(readerPreferencesSchema, () =>
      apiJson<ReaderPreferencesDto>("/api/v1/me/preferences", {
        method: "PATCH",
        headers,
        body: JSON.stringify(data),
      }),
    );
  });

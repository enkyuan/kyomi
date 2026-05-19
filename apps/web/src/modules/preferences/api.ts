import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { apiJson, buildForwardHeaders } from "@lib/api";
import { apiJsonValidated, type UserPreferencesDto, userPreferencesSchema } from "src/lib/schemas";

export const getUserPreferences = createServerFn({ method: "GET" }).handler(
  async (): Promise<UserPreferencesDto> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    return apiJsonValidated(userPreferencesSchema, () =>
      apiJson<UserPreferencesDto>("/api/v1/me/preferences", { headers }),
    );
  },
);

export const updateUserPreferences = createServerFn({ method: "POST" })
  .inputValidator((input: Partial<UserPreferencesDto>) => input)
  .handler(async ({ data }): Promise<UserPreferencesDto> => {
    const headers = buildForwardHeaders(getRequestHeaders());
    headers.set("content-type", "application/json");

    return apiJsonValidated(userPreferencesSchema, () =>
      apiJson<UserPreferencesDto>("/api/v1/me/preferences", {
        method: "PATCH",
        headers,
        body: JSON.stringify(data),
      }),
    );
  });

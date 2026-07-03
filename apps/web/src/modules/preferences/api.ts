import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { apiJson, buildForwardHeaders } from "@lib/api";
import type { UserPreferencesDto } from "@lib/schemas/index";

let preferencesSchemaModulePromise:
  | Promise<
      Pick<typeof import("@lib/schemas/index"), "fetchValidatedJson" | "userPreferencesSchema">
    >
  | undefined;

function getPreferencesSchemaModule() {
  preferencesSchemaModulePromise ??= import("@lib/schemas/index").then((module) => ({
    fetchValidatedJson: module.fetchValidatedJson,
    userPreferencesSchema: module.userPreferencesSchema,
  }));
  return preferencesSchemaModulePromise;
}

export const getUserPreferences = createServerFn({ method: "GET" }).handler(
  async (): Promise<UserPreferencesDto> => {
    const { fetchValidatedJson, userPreferencesSchema } = await getPreferencesSchemaModule();
    const headers = buildForwardHeaders(getRequestHeaders());
    return fetchValidatedJson(userPreferencesSchema, () =>
      apiJson<UserPreferencesDto>("/api/v1/me/preferences", { headers }),
    );
  },
);

export const updateUserPreferences = createServerFn({ method: "POST" })
  .inputValidator((input: Partial<UserPreferencesDto>) => input)
  .handler(async ({ data }): Promise<UserPreferencesDto> => {
    const { fetchValidatedJson, userPreferencesSchema } = await getPreferencesSchemaModule();
    const headers = buildForwardHeaders(getRequestHeaders());
    headers.set("content-type", "application/json");

    return fetchValidatedJson(userPreferencesSchema, () =>
      apiJson<UserPreferencesDto>("/api/v1/me/preferences", {
        method: "PATCH",
        headers,
        body: JSON.stringify(data),
      }),
    );
  });

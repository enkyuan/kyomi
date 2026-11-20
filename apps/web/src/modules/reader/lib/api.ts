import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { translationResultSchema } from "@kyomi/reader/schemas/translation";
import { apiJson, buildForwardHeaders } from "@lib/api";
import { parseUuid } from "@lib/ids";

export const requestTranslation = createServerFn({ method: "POST" })
  .validator(
    z.object({
      itemId: z.uuid(),
      mode: z.enum(["original", "extracted"]),
      language: z.string().min(1).max(64).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const headers = buildForwardHeaders(getRequestHeaders());
    headers.set("content-type", "application/json");
    return translationResultSchema.parse(
      await apiJson(`/api/v1/articles/${data.itemId}/translate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ mode: data.mode, target_language: data.language }),
      }),
    );
  });

export const getTranslation = createServerFn({ method: "GET" })
  .validator((input: { itemId: string; translationId: string }) => ({
    itemId: parseUuid(input.itemId),
    translationId: parseUuid(input.translationId),
  }))
  .handler(async ({ data }) =>
    translationResultSchema.parse(
      await apiJson(`/api/v1/articles/${data.itemId}/translations/${data.translationId}`, {
        headers: buildForwardHeaders(getRequestHeaders()),
      }),
    ),
  );

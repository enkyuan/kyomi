import { describe, expect, test } from "bun:test";
import {
  MAX_CLOUDFLARE_TRANSLATION_CHARS,
  translateTextWithCloudflare,
} from "@adapters/translation/cloudflare";
import type { CloudflareTranslationConfig } from "@config/translations";

const config: CloudflareTranslationConfig = {
  apiUrl: "https://translations.test/translate",
  apiKey: "test-token",
  model: "@cf/meta/m2m100-1.2b",
  timeoutMs: 1_000,
};

describe("Cloudflare article translations", () => {
  test("sends the Worker contract and returns translated text", async () => {
    let request: Request | undefined;

    const translated = await translateTextWithCloudflare(
      {
        text: "Kyomi organizes your feeds.",
        sourceLanguage: "en",
        targetLanguage: "es",
      },
      config,
      {
        fetchImpl: async (input, init) => {
          request = new Request(input, init);
          return Response.json({
            translated_text: "Kyomi organiza tus feeds.",
          });
        },
      },
    );

    expect(translated).toBe("Kyomi organiza tus feeds.");
    expect(request?.headers.get("Authorization")).toBe("Bearer test-token");
    expect(await request?.json()).toEqual({
      text: "Kyomi organizes your feeds.",
      source_language: "en",
      target_language: "es",
    });
  });

  test("rejects article text beyond the Worker limit", async () => {
    await expect(
      translateTextWithCloudflare(
        {
          text: "x".repeat(MAX_CLOUDFLARE_TRANSLATION_CHARS + 1),
          sourceLanguage: "en",
          targetLanguage: "es",
        },
        config,
      ),
    ).rejects.toMatchObject({
      code: "TRANSLATION_CONTENT_TOO_LARGE",
      status: 413,
    });
  });

  test("does not accept malformed Worker responses", async () => {
    await expect(
      translateTextWithCloudflare(
        { text: "Hello", sourceLanguage: "en", targetLanguage: "es" },
        config,
        { fetchImpl: async () => Response.json({}) },
      ),
    ).rejects.toMatchObject({
      code: "TRANSLATION_PROVIDER_INVALID_RESPONSE",
      status: 502,
    });
  });
});

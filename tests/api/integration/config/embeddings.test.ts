import { describe, expect, test } from "bun:test";
import {
  CLOUDFLARE_EMBEDDING_MODEL,
  CLOUDFLARE_EMBEDDING_MODEL_ID,
  EMBEDDING_CLASSIFIER_MODEL_ID,
  embeddingModelInfo,
} from "@kyomi/worker";
import { activeEmbeddingModelId, embeddingClassifierConfig } from "@config/embeddings";

const CLOUDFLARE_ENV = {
  CLOUDFLARE_EMBEDDINGS_URL: "https://kyomi-embeddings.example.workers.dev/embed",
  CLOUDFLARE_EMBEDDINGS_TOKEN: "cloudflare-token",
  VOYAGE_API_KEY: undefined,
};
const VOYAGE_ENV = {
  CLOUDFLARE_EMBEDDINGS_URL: undefined,
  CLOUDFLARE_EMBEDDINGS_TOKEN: undefined,
  VOYAGE_API_KEY: "voyage-key",
};
const NO_PROVIDER_ENV = {
  CLOUDFLARE_EMBEDDINGS_URL: undefined,
  CLOUDFLARE_EMBEDDINGS_TOKEN: undefined,
  VOYAGE_API_KEY: undefined,
};

describe("embeddingClassifierConfig", () => {
  test("stamps Cloudflare rows with the card-versioned id instead of the model name", () => {
    const config = embeddingClassifierConfig(undefined, CLOUDFLARE_ENV);

    expect(config).toEqual({
      apiKey: "cloudflare-token",
      apiUrl: "https://kyomi-embeddings.example.workers.dev/embed",
      model: CLOUDFLARE_EMBEDDING_MODEL,
      assignmentModelId: CLOUDFLARE_EMBEDDING_MODEL_ID,
    });
    expect(embeddingModelInfo(config!).modelId).toBe(CLOUDFLARE_EMBEDDING_MODEL_ID);
  });

  test("keeps one model id whether or not a caller sets a timeout", () => {
    // Extraction passes a timeout and refresh and backfill don't; all three must replace the
    // same rows.
    const withTimeout = embeddingClassifierConfig(8_000, CLOUDFLARE_ENV);
    const withoutTimeout = embeddingClassifierConfig(undefined, CLOUDFLARE_ENV);

    expect(withTimeout?.timeoutMs).toBe(8_000);
    expect(embeddingModelInfo(withTimeout!).modelId).toBe(
      embeddingModelInfo(withoutTimeout!).modelId,
    );
  });

  test("prefers the Cloudflare Worker when Voyage is also configured", () => {
    const config = embeddingClassifierConfig(undefined, {
      ...CLOUDFLARE_ENV,
      VOYAGE_API_KEY: "voyage-key",
    });

    expect(config?.apiKey).toBe("cloudflare-token");
  });

  test("uses Voyage when only its key is set", () => {
    const config = embeddingClassifierConfig(undefined, VOYAGE_ENV);

    expect(config).toEqual({ apiKey: "voyage-key" });
    expect(embeddingModelInfo(config!).modelId).toBe(EMBEDDING_CLASSIFIER_MODEL_ID);
  });

  test("returns no provider when nothing is configured", () => {
    expect(embeddingClassifierConfig(undefined, NO_PROVIDER_ENV)).toBeUndefined();
  });
});

describe("activeEmbeddingModelId", () => {
  test("names the model id each configured provider writes", () => {
    expect(activeEmbeddingModelId(CLOUDFLARE_ENV)).toBe(CLOUDFLARE_EMBEDDING_MODEL_ID);
    expect(activeEmbeddingModelId(VOYAGE_ENV)).toBe(EMBEDDING_CLASSIFIER_MODEL_ID);
  });

  test("is undefined when no provider is configured", () => {
    expect(activeEmbeddingModelId(NO_PROVIDER_ENV)).toBeUndefined();
  });
});

import { describe, expect, test } from "bun:test";
import { EMBEDDING_CLASSIFIER_MODEL_ID, embeddingModelInfo } from "@kyomi/worker";
import { activeEmbeddingModelId, embeddingClassifierConfig } from "@config/embeddings";

// Rows name the model, the category head, and the selection rule they were written under:
// `<model>/<head>/<rule>`.
const MODEL_ID_PATTERN = new RegExp(
  `^${EMBEDDING_CLASSIFIER_MODEL_ID.replaceAll("/", "\\/")}\\/[^/]+\\/item-`,
);

const WORKER_ENV = {
  CLOUDFLARE_EMBEDDINGS_URL: "https://kyomi-embeddings.example.workers.dev/embed",
  CLOUDFLARE_EMBEDDINGS_TOKEN: "cloudflare-token",
};
const NO_WORKER_ENV = {
  CLOUDFLARE_EMBEDDINGS_URL: undefined,
  CLOUDFLARE_EMBEDDINGS_TOKEN: undefined,
};

describe("embeddingClassifierConfig", () => {
  test("points the classifier at the embeddings Worker", () => {
    const config = embeddingClassifierConfig(undefined, WORKER_ENV);

    expect(config).toEqual({
      apiKey: "cloudflare-token",
      apiUrl: "https://kyomi-embeddings.example.workers.dev/embed",
    });
    expect(embeddingModelInfo(config!).modelId).toMatch(MODEL_ID_PATTERN);
  });

  test("gives rows written under another selection rule a different model id", () => {
    const config = embeddingClassifierConfig(undefined, WORKER_ENV)!;

    expect(embeddingModelInfo({ ...config, itemMinProbability: 0.99 }).modelId).not.toBe(
      embeddingModelInfo(config).modelId,
    );
  });

  test("keeps one model id whether or not a caller sets a timeout", () => {
    // Extraction passes a timeout and refresh and backfill don't; all three must replace the
    // same rows.
    const withTimeout = embeddingClassifierConfig(8_000, WORKER_ENV);
    const withoutTimeout = embeddingClassifierConfig(undefined, WORKER_ENV);

    expect(withTimeout?.timeoutMs).toBe(8_000);
    expect(embeddingModelInfo(withTimeout!).modelId).toBe(
      embeddingModelInfo(withoutTimeout!).modelId,
    );
  });

  test("needs both Worker values", () => {
    expect(embeddingClassifierConfig(undefined, NO_WORKER_ENV)).toBeUndefined();
    expect(
      embeddingClassifierConfig(undefined, {
        ...WORKER_ENV,
        CLOUDFLARE_EMBEDDINGS_TOKEN: undefined,
      }),
    ).toBeUndefined();
  });
});

describe("activeEmbeddingModelId", () => {
  test("names the model id the configured Worker writes", () => {
    expect(activeEmbeddingModelId(WORKER_ENV)).toMatch(MODEL_ID_PATTERN);
  });

  test("is undefined when no Worker is configured", () => {
    expect(activeEmbeddingModelId(NO_WORKER_ENV)).toBeUndefined();
  });
});

import {
  CLOUDFLARE_EMBEDDING_MODEL,
  embeddingModelInfo,
  type EmbeddingClassifierConfig,
} from "@kyomi/worker";
import { env } from "@config/env";

/**
 * BGE-M3 scores real articles at about 0.40-0.55 with a median top-two gap of 0.025, so the 0.6
 * defaults in @kyomi/worker (tuned for Voyage on headline fixtures) leave ~99% of articles
 * unlabeled. Calibrated on the stored-article set with
 * tests/api/integration/modules/feeds/refresh/classifier-eval-sweep.test.ts; re-run that sweep
 * when the model or category cards change.
 */
const CLOUDFLARE_BGE_M3_THRESHOLDS = {
  itemSimilarityThreshold: 0.41,
  feedSimilarityThreshold: 0.5,
  secondaryLabelMargin: 0.02,
} satisfies Partial<EmbeddingClassifierConfig>;

type EmbeddingProviderEnv = Pick<
  typeof env,
  "CLOUDFLARE_EMBEDDINGS_URL" | "CLOUDFLARE_EMBEDDINGS_TOKEN" | "VOYAGE_API_KEY"
>;

/**
 * The embedding provider shared by every classifier writer (refresh, extraction, backfill), so
 * they all stamp rows with the same model id. The Cloudflare Worker wins when both of its values
 * are set; otherwise Voyage is used when its key is set.
 */
export function embeddingClassifierConfig(
  timeoutMs?: number,
  values: EmbeddingProviderEnv = env,
): EmbeddingClassifierConfig | undefined {
  const timeout = timeoutMs === undefined ? {} : { timeoutMs };

  const cloudflareUrl = values.CLOUDFLARE_EMBEDDINGS_URL;
  const cloudflareToken = values.CLOUDFLARE_EMBEDDINGS_TOKEN;

  if (cloudflareUrl && cloudflareToken) {
    return {
      apiKey: cloudflareToken,
      apiUrl: cloudflareUrl,
      model: CLOUDFLARE_EMBEDDING_MODEL,
      ...CLOUDFLARE_BGE_M3_THRESHOLDS,
      ...timeout,
    };
  }

  const voyageApiKey = values.VOYAGE_API_KEY;

  if (voyageApiKey) {
    return {
      apiKey: voyageApiKey,
      ...timeout,
    };
  }

  return undefined;
}

/** Model id on rows written by the configured provider; undefined when none is configured. */
export function activeEmbeddingModelId(values: EmbeddingProviderEnv = env): string | undefined {
  const config = embeddingClassifierConfig(undefined, values);
  return config ? embeddingModelInfo(config).modelId : undefined;
}

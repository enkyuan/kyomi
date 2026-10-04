import {
  CLOUDFLARE_EMBEDDING_MODEL,
  CLOUDFLARE_EMBEDDING_MODEL_ID,
  embeddingModelInfo,
  type EmbeddingClassifierConfig,
} from "@kyomi/worker";
import { env } from "@config/env";

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
      assignmentModelId: CLOUDFLARE_EMBEDDING_MODEL_ID,
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

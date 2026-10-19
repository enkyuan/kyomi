import { embeddingModelInfo, type EmbeddingClassifierConfig } from "@kyomi/worker";
import { env } from "@config/env";

type EmbeddingProviderEnv = Pick<
  typeof env,
  "CLOUDFLARE_EMBEDDINGS_URL" | "CLOUDFLARE_EMBEDDINGS_TOKEN"
>;

/**
 * The embeddings Worker config shared by every classifier writer (refresh, extraction, backfill),
 * so they all stamp rows with the same model id. Undefined unless both Worker values are set; the
 * keyword classifier then runs alone.
 */
export function embeddingClassifierConfig(
  timeoutMs?: number,
  values: EmbeddingProviderEnv = env,
): EmbeddingClassifierConfig | undefined {
  const apiUrl = values.CLOUDFLARE_EMBEDDINGS_URL;
  const apiKey = values.CLOUDFLARE_EMBEDDINGS_TOKEN;
  if (!apiUrl || !apiKey) {
    return undefined;
  }
  return timeoutMs === undefined ? { apiKey, apiUrl } : { apiKey, apiUrl, timeoutMs };
}

/** Model id on rows the configured Worker writes; undefined when none is configured. */
export function activeEmbeddingModelId(values: EmbeddingProviderEnv = env): string | undefined {
  const config = embeddingClassifierConfig(undefined, values);
  return config ? embeddingModelInfo(config).modelId : undefined;
}

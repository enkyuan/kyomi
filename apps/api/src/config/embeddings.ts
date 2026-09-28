import type { EmbeddingClassifierConfig } from "@kyomi/worker";
import { env } from "@config/env";

export function embeddingClassifierConfig(
  timeoutMs?: number,
): EmbeddingClassifierConfig | undefined {
  const timeout = timeoutMs === undefined ? {} : { timeoutMs };

  const cloudflareUrl = env.CLOUDFLARE_EMBEDDINGS_URL;
  const cloudflareToken = env.CLOUDFLARE_EMBEDDINGS_TOKEN;

  if (cloudflareUrl && cloudflareToken) {
    return {
      apiKey: cloudflareToken,
      apiUrl: cloudflareUrl,
      model: "@cf/baai/bge-m3",
      ...timeout,
    };
  }

  const voyageApiKey = env.VOYAGE_API_KEY;

  if (voyageApiKey) {
    return {
      apiKey: voyageApiKey,
      ...timeout,
    };
  }

  return undefined;
}

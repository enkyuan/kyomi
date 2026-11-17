import { env } from "@config/env";

export const CLOUDFLARE_TRANSLATION_MODEL = "@cf/meta/m2m100-1.2b";

export type CloudflareTranslationConfig = {
  apiKey: string;
  apiUrl: string;
  model: typeof CLOUDFLARE_TRANSLATION_MODEL;
  timeoutMs: number;
};

type TranslationProviderEnv = Pick<
  typeof env,
  "FEATURE_ARTICLE_TRANSLATIONS" | "CLOUDFLARE_TRANSLATIONS_URL" | "CLOUDFLARE_TRANSLATIONS_TOKEN"
>;

/**
 * Translation is deliberately opt-in: a configured token alone does not make article text leave
 * Kyomi. The runtime environment schema enforces the URL/token pair whenever this flag is true.
 */
export function cloudflareTranslationConfig(
  values: TranslationProviderEnv = env,
): CloudflareTranslationConfig | undefined {
  if (!values.FEATURE_ARTICLE_TRANSLATIONS) {
    return undefined;
  }

  const apiUrl = values.CLOUDFLARE_TRANSLATIONS_URL;
  const apiKey = values.CLOUDFLARE_TRANSLATIONS_TOKEN;
  if (!apiUrl || !apiKey) {
    return undefined;
  }

  return {
    apiKey,
    apiUrl,
    model: CLOUDFLARE_TRANSLATION_MODEL,
    timeoutMs: 20_000,
  };
}

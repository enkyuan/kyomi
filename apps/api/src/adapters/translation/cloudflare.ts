import type { CloudflareTranslationConfig } from "@config/translations";
import { AppError } from "@shared/errors/app";

export const MAX_CLOUDFLARE_TRANSLATION_CHARS = 6_000;

export type TranslateTextInput = {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
};

type TranslateTextOptions = {
  fetchImpl?: typeof fetch;
};

function translatedText(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }
  const value = payload as { translated_text?: unknown };
  return typeof value.translated_text === "string" && value.translated_text.trim().length > 0
    ? value.translated_text
    : undefined;
}

/** Calls Kyomi's private Worker endpoint; callers own article authorization and persistence. */
export async function translateTextWithCloudflare(
  input: TranslateTextInput,
  config: CloudflareTranslationConfig,
  options: TranslateTextOptions = {},
): Promise<string> {
  const text = input.text.trim();
  if (!text) {
    throw new AppError("No content available to translate", {
      status: 400,
      code: "TRANSLATION_CONTENT_MISSING",
    });
  }
  if (text.length > MAX_CLOUDFLARE_TRANSLATION_CHARS) {
    throw new AppError("Article content exceeds the translation limit", {
      status: 413,
      code: "TRANSLATION_CONTENT_TOO_LARGE",
      details: { maxChars: MAX_CLOUDFLARE_TRANSLATION_CHARS },
    });
  }

  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(config.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        source_language: input.sourceLanguage,
        target_language: input.targetLanguage,
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new AppError("Translation request timed out", {
        status: 504,
        code: "TRANSLATION_PROVIDER_TIMEOUT",
        cause: error,
      });
    }
    throw new AppError("Translation service is unavailable", {
      status: 502,
      code: "TRANSLATION_PROVIDER_UNAVAILABLE",
      cause: error,
    });
  }

  if (!response.ok) {
    throw new AppError("Translation service failed", {
      status: response.status === 429 ? 503 : 502,
      code:
        response.status === 429
          ? "TRANSLATION_PROVIDER_RATE_LIMITED"
          : "TRANSLATION_PROVIDER_FAILED",
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new AppError("Translation service returned invalid JSON", {
      status: 502,
      code: "TRANSLATION_PROVIDER_INVALID_RESPONSE",
      cause: error,
    });
  }

  const translated = translatedText(payload);
  if (!translated) {
    throw new AppError("Translation service returned an invalid response", {
      status: 502,
      code: "TRANSLATION_PROVIDER_INVALID_RESPONSE",
    });
  }
  return translated;
}

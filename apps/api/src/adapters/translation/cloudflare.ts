import type { CloudflareTranslationConfig } from "@config/translations";
import {
  BadRequest,
  BadGateway,
  PayloadTooLarge,
  GatewayTimeout,
  Unavailable,
} from "@shared/effect/errors";

export const MAX_CLOUDFLARE_TRANSLATION_CHARS = 6_000;

export type TranslateTextInput = {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
};

type TranslateTextOptions = {
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
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
    throw new BadRequest({
      message: "No content available to translate",
      code: "TRANSLATION_CONTENT_MISSING",
    });
  }
  if (text.length > MAX_CLOUDFLARE_TRANSLATION_CHARS) {
    throw new PayloadTooLarge({
      message: "Article content exceeds the translation limit",
      code: "TRANSLATION_CONTENT_TOO_LARGE",
      details: { maxChars: MAX_CLOUDFLARE_TRANSLATION_CHARS },
    });
  }

  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(config.apiUrl, {
      method: "POST",
      redirect: "error",
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
      throw new GatewayTimeout({
        message: "Translation request timed out",
        code: "TRANSLATION_PROVIDER_TIMEOUT",
        cause: error,
      });
    }
    throw new BadGateway({
      message: "Translation service is unavailable",
      code: "TRANSLATION_PROVIDER_UNAVAILABLE",
      cause: error,
    });
  }

  if (!response.ok) {
    const Failure = response.status === 429 ? Unavailable : BadGateway;
    throw new Failure({
      message: "Translation service failed",
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
    throw new BadGateway({
      message: "Translation service returned invalid JSON",
      code: "TRANSLATION_PROVIDER_INVALID_RESPONSE",
      cause: error,
    });
  }

  const translated = translatedText(payload);
  if (!translated) {
    throw new BadGateway({
      message: "Translation service returned an invalid response",
      code: "TRANSLATION_PROVIDER_INVALID_RESPONSE",
    });
  }
  return translated;
}

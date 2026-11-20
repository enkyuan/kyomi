import type { Database as DB } from "@adapters/db/service";
import { translateTextWithCloudflare } from "@adapters/translation/cloudflare";
import type { CloudflareTranslationConfig } from "@config/translations";
import { isApiError } from "@shared/effect/errors";
import {
  claimFeedItemTranslation,
  markFeedItemTranslationFailed,
  markFeedItemTranslationReady,
  requeueFeedItemTranslation,
} from "./store";

export const TRANSLATION_MAX_ATTEMPTS = 3;

export type TranslationJobResult =
  | { status: "ready"; translationId: string }
  | { status: "retry"; translationId: string; errorCode: string }
  | { status: "failed"; translationId: string; errorCode: string }
  | { status: "skipped"; translationId: string };

function errorCodeFor(error: unknown): string {
  return isApiError(error) && "code" in error && error.code
    ? error.code
    : "TRANSLATION_PROVIDER_FAILED";
}

function isNonRetryable(error: unknown): boolean {
  return (
    isApiError(error) &&
    "code" in error &&
    error.code !== undefined &&
    ["TRANSLATION_CONTENT_MISSING", "TRANSLATION_CONTENT_TOO_LARGE"].includes(error.code)
  );
}

export async function runFeedItemTranslationJob(
  database: DB,
  translationId: string,
  config: CloudflareTranslationConfig | undefined,
): Promise<TranslationJobResult> {
  const claimed = await claimFeedItemTranslation(database, translationId);

  // Already translated, actively leased, or no longer exists.
  if (!claimed) {
    return { status: "skipped", translationId };
  }

  if (!config) {
    await markFeedItemTranslationFailed(database, {
      translationId,
      leaseToken: claimed.leaseToken,
      errorCode: "TRANSLATION_NOT_CONFIGURED",
    });

    return {
      status: "failed",
      translationId,
      errorCode: "TRANSLATION_NOT_CONFIGURED",
    };
  }

  try {
    const translatedText = await translateTextWithCloudflare(
      {
        text: claimed.translation.sourceText,
        sourceLanguage: claimed.translation.sourceLanguage,
        targetLanguage: claimed.translation.targetLanguage,
      },
      config,
    );

    const saved = await markFeedItemTranslationReady(database, {
      translationId,
      leaseToken: claimed.leaseToken,
      translatedText,
    });

    return saved ? { status: "ready", translationId } : { status: "skipped", translationId };
  } catch (error) {
    const errorCode = errorCodeFor(error);

    if (isNonRetryable(error) || claimed.translation.attempts >= TRANSLATION_MAX_ATTEMPTS) {
      await markFeedItemTranslationFailed(database, {
        translationId,
        leaseToken: claimed.leaseToken,
        errorCode,
      });

      return { status: "failed", translationId, errorCode };
    }

    await requeueFeedItemTranslation(database, {
      translationId,
      leaseToken: claimed.leaseToken,
      errorCode,
    });

    return { status: "retry", translationId, errorCode };
  }
}

import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { feedItemTranslations } from "@kyomi/db";
import { modelLanguage } from "@kyomi/reader/schemas/translation";
import { Db } from "@adapters/db/service";
import { JobQueue } from "@adapters/queue/service";
import { MAX_CLOUDFLARE_TRANSLATION_CHARS } from "@adapters/translation/cloudflare";
import { AppConfig } from "@config/env/service";
import { cloudflareTranslationConfig } from "@config/translations";
import { CurrentUser } from "@shared/effect/request";
import { BadRequest, NotFound, PayloadTooLarge, Unavailable } from "@shared/effect/errors";
import { getUserPreferences } from "@modules/users/preferences/settings";
import { getArticleDetail } from "../../read/detail";
import { findOrQueueFeedItemTranslation, type FeedItemTranslation } from "./store";

type RequestBody = {
  source_language?: string;
  target_language?: string;
  mode?: "original" | "extracted";
};

const responseColumns = {
  id: feedItemTranslations.id,
  status: feedItemTranslations.status,
  translatedText: feedItemTranslations.translatedText,
  targetLanguage: feedItemTranslations.targetLanguage,
  sourceLanguage: feedItemTranslations.sourceLanguage,
  errorCode: feedItemTranslations.errorCode,
};
function response(row: Pick<FeedItemTranslation, keyof typeof responseColumns>) {
  return {
    id: row.id,
    status: row.status as "ready" | "queued" | "processing" | "failed",
    translated_content: row.translatedText,
    target_language: row.targetLanguage,
    source_language: row.sourceLanguage,
    error_code: row.errorCode,
  };
}

export const translateArticle = Effect.fn("articles.translate")(function* (
  articleId: string,
  body: RequestBody,
) {
  const { userId } = yield* CurrentUser;
  const article = yield* getArticleDetail(userId, articleId);
  const config = cloudflareTranslationConfig(yield* AppConfig);
  if (!config)
    return yield* new Unavailable({
      message: "Article translation is disabled.",
      code: "TRANSLATION_NOT_CONFIGURED",
    });
  if (article.articleType !== "feed")
    return yield* new BadRequest({
      message: "Only feed articles can be translated.",
      code: "TRANSLATION_ARTICLE_TYPE_UNSUPPORTED",
    });
  const selected = (body.mode && article.reader[body.mode].content) || article.reader.selected;
  const sourceText = [selected?.contentText, selected?.contentMarkdown, selected?.fallbackSummary]
    .find((value) => value?.trim())
    ?.trim();
  if (!sourceText)
    return yield* new BadRequest({
      message: "No article text is available to translate.",
      code: "TRANSLATION_CONTENT_MISSING",
    });
  if (sourceText.length > MAX_CLOUDFLARE_TRANSLATION_CHARS)
    return yield* new PayloadTooLarge({
      message: "Translation supports articles up to 6,000 characters.",
      code: "TRANSLATION_CONTENT_TOO_LARGE",
    });
  const sourceLanguage = modelLanguage(body.source_language ?? selected?.language ?? "en");
  const targetLanguage = modelLanguage(
    body.target_language ?? (yield* getUserPreferences).language,
  );
  if (!sourceLanguage || !targetLanguage)
    return yield* new BadRequest({
      message: "This language is unsupported by article translation.",
      code: "TRANSLATION_LANGUAGE_INVALID",
    });
  const db = yield* Db;
  const { translation } = yield* db.use("translations.request", (client) =>
    findOrQueueFeedItemTranslation(client, {
      feedItemId: articleId,
      sourceText,
      sourceLanguage,
      targetLanguage,
      modelId: config.model,
    }),
  );
  if (
    translation.status === "queued" ||
    (translation.status === "processing" &&
      translation.leaseExpiresAt &&
      translation.leaseExpiresAt.getTime() <= Date.now())
  ) {
    const queue = yield* JobQueue;
    yield* queue
      .publish({ type: "article.translate", payload: { translationId: translation.id } })
      .pipe(
        Effect.mapError(
          (cause) =>
            new Unavailable({
              message: "Translation could not be queued.",
              code: "TRANSLATION_QUEUE_UNAVAILABLE",
              cause,
            }),
        ),
      );
  }
  return response(translation);
});

// Feed articles are shared with authenticated readers. The composite lookup binds every
// status read to its article, and private clips never enter the translation table.
export const readTranslation = Effect.fn("articles.translationStatus")(function* (
  articleId: string,
  translationId: string,
) {
  yield* CurrentUser;
  const db = yield* Db;
  const [row] = yield* db.use("translations.status", (client) =>
    client
      .select(responseColumns)
      .from(feedItemTranslations)
      .where(
        and(
          eq(feedItemTranslations.id, translationId),
          eq(feedItemTranslations.feedItemId, articleId),
        ),
      )
      .limit(1),
  );
  if (!row)
    return yield* new NotFound({
      message: "Translation not found.",
      code: "TRANSLATION_NOT_FOUND",
    });
  return response(row);
});

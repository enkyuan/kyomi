import { Effect } from "effect";
import { AppLogger } from "@adapters/logger/service";
import { AppConfig } from "@config/env/service";
import { withNegotiatedDocuments } from "@modules/articles/document/serve";
import { CurrentUser } from "@shared/effect/request";
import { checkContentFieldBudget } from "@shared/http/budget";
import { getArticleDetail } from "../read/detail";
import { resolveEnhancementContent, summarizeContent } from "./enrichment";
import { requestFullTextExtractionForUser } from "./extraction/workflow";

const loadArticle = Effect.fn("articles.reader.load")(function* (articleId: string) {
  const { userId } = yield* CurrentUser;
  return yield* getArticleDetail(userId, articleId);
});

/** Text the enrichment endpoints work on, within the content budget. */
const enhancementContent = Effect.fn("articles.reader.content")(function* (
  articleId: string,
  requestContent: string | undefined,
) {
  const article = yield* loadArticle(articleId);
  const content = yield* resolveEnhancementContent(requestContent, article);
  yield* checkContentFieldBudget([{ name: "content", value: content }]);
  return content;
});

export const summarizeArticle = Effect.fn("articles.summarize")(function* (
  articleId: string,
  body: { content?: string; language_key?: string },
) {
  const log = yield* AppLogger;
  const { userId } = yield* CurrentUser;
  const content = yield* enhancementContent(articleId, body.content);
  const summary = yield* summarizeContent(content, body.language_key);
  yield* log.info("articles.summarize.succeeded", { userId, articleId });
  return { summary };
});

/**
 * Queues (or serves from cache) a full-text extraction. The article in the response follows the
 * same document negotiation as `GET /articles/:id`, so a client never swaps from a document body
 * to an HTML one just by extracting.
 */
export const extractArticleFullText = Effect.fn("articles.extractFullText")(function* (
  articleId: string,
  negotiation: { maxVersion: number },
) {
  const log = yield* AppLogger;
  const config = yield* AppConfig;
  const { userId } = yield* CurrentUser;

  const extraction = yield* requestFullTextExtractionForUser(userId, articleId);
  const article = yield* withNegotiatedDocuments(extraction.article, {
    enabled: config.FEATURE_READER_DOCUMENT,
    maxVersion: negotiation.maxVersion,
  });

  const result = { ...extraction, article };
  if (result.ok) {
    yield* log.info("articles.extract_full_text.accepted", {
      userId,
      articleId,
      status: result.status,
    });
  } else {
    yield* log.warn("articles.extract_full_text.failed", {
      userId,
      articleId,
      errorCode: result.errorCode,
    });
  }
  return result;
});

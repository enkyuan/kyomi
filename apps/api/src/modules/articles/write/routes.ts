import type { Elysia } from "elysia";
import { v1HandlerContext } from "@shared/http/v1-handler-context";
import { createArticleClip } from "./clips";
import {
  articleDetailSchema,
  articleIdParamsSchema,
  createClipBodySchema,
  messageResponseSchema,
  updateArticleBodySchema,
} from "../schemas";
import { updateArticleOrClipForUser } from "./update";

export function registerArticleWriteRoutes(app: Elysia) {
  return app
    .post(
      "/articles",
      async (context) => {
        const { body, db, logger, set, userId } = v1HandlerContext<{
          url: string;
          title?: string;
          content?: string;
          note?: string;
        }>(context);
        const detail = await createArticleClip(db, userId, {
          url: body.url,
          title: body.title,
          content: body.content,
          note: body.note,
        });
        logger.info("articles.clip.created", { userId, clipId: detail.id });
        set.status = 201;
        return detail;
      },
      {
        body: createClipBodySchema,
        response: {
          201: articleDetailSchema,
        },
      },
    )
    .put(
      "/articles/:articleId",
      async (context) => {
        const { body, db, params, userId } = v1HandlerContext<
          {
            isRead?: boolean | null;
            isSaved?: boolean;
            title?: string;
            note?: string | null;
            contentHtml?: string | null;
            contentText?: string | null;
            contentMarkdown?: string | null;
            contentStatus?: "ready" | "partial" | "failed" | "pending" | null;
            contentSource?:
              | "feed_html"
              | "feed_markdown"
              | "feed_summary"
              | "extracted_html"
              | "text_fallback"
              | "link_only"
              | null;
            extractionErrorCode?: string | null;
            extractionErrorMessage?: string | null;
          },
          Record<string, unknown>,
          { articleId: string }
        >(context);
        await updateArticleOrClipForUser(db, userId, params.articleId, body);
        return { message: "Article updated" };
      },
      {
        params: articleIdParamsSchema,
        body: updateArticleBodySchema,
        response: { 200: messageResponseSchema },
      },
    );
}

import type { Elysia } from "elysia";
import { t } from "elysia";
import { v1HandlerContext } from "@shared/http/v1-handler-context";
import { previewFeedFromUrl } from "./discover.service";

const feedPreviewResponse = t.Object({
  id: t.Union([t.String(), t.Null()]),
  url: t.String(),
  title: t.String(),
  description: t.String(),
  link: t.Union([t.String(), t.Null()]),
  isSubscribed: t.Boolean(),
});

export function registerDiscoverRoutes(app: Elysia) {
  return app.get(
    "/discover/preview",
    async (context) => {
      const { db, logger, userId, query } = v1HandlerContext(context);
      const rawUrl = typeof query.url === "string" ? query.url : "";
      const preview = await previewFeedFromUrl(db, userId, rawUrl);
      logger.info("discover.preview.ok", {
        userId,
        url: preview.url,
        isSubscribed: preview.isSubscribed,
      });
      return preview;
    },
    {
      query: t.Object({
        url: t.String({ minLength: 1 }),
      }),
      response: {
        200: feedPreviewResponse,
      },
    },
  );
}

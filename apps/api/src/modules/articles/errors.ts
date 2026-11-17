import { NotFound } from "@shared/effect/errors";

/** The article does not exist or is not visible to the user. */
export const articleNotFound = () =>
  new NotFound({ message: "Article not found", code: "ARTICLE_NOT_FOUND" });

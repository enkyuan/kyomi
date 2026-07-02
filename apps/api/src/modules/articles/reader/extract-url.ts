import { AppError } from "@shared/errors/app";
import { extractArticleContentFromUrl } from "./extract-content";

export async function extractFullTextFromUrl(url: string): Promise<string> {
  const extracted = await extractArticleContentFromUrl(url);
  if (!extracted.ok) {
    throw new AppError(extracted.errorMessage, {
      status: 400,
      code: extracted.errorCode,
    });
  }

  if (!extracted.content.contentHtml) {
    throw new AppError("No readable HTML content was extracted.", {
      status: 400,
      code: "EXTRACTION_EMPTY",
    });
  }

  return extracted.content.contentHtml;
}

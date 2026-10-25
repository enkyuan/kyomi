"use client";

import { createContext, use } from "react";
import type { ReaderImageLoading } from "../../core/types";
import type { ReaderImageUrlTransformer } from "../html/url-resolve";

export type DocumentContextValue = {
  baseUrl: string | null;
  openLinksInNewTab: boolean;
  showLinkPreviews: boolean;
  imageLoading: ReaderImageLoading;
  transformImageUrl: ReaderImageUrlTransformer | undefined;
  /** Opens the photo viewer on the image whose resolved `src` matches. */
  openPhoto: (src: string, openedWithKeyboard: boolean) => void;
};

const DocumentContext = createContext<DocumentContextValue | null>(null);

export const DocumentProvider = DocumentContext.Provider;

export function useDocumentContext(): DocumentContextValue {
  const value = use(DocumentContext);
  if (!value) {
    throw new Error("Document blocks must render inside RenderDocument.");
  }
  return value;
}

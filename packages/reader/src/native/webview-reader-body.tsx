import React from "react";
import type { ReaderContent, ReaderLayoutMode, ReaderPreferences } from "../core/types";
import { createReaderDocument } from "../webview/create-document";

/** Native entry: React is required here for `renderWebView`; string HTML still comes from `createReaderDocument`. */

export type WebViewReaderBodyProps = {
  reader: ReaderContent;
  preferences?: Partial<ReaderPreferences>;
  layoutMode?: ReaderLayoutMode;
  renderWebView: (input: { html: string }) => React.ReactElement;
};

export function WebViewReaderBody({
  reader,
  preferences,
  layoutMode,
  renderWebView,
}: WebViewReaderBodyProps): React.ReactElement {
  const html = createReaderDocument({ reader, preferences, layoutMode });
  return renderWebView({ html });
}

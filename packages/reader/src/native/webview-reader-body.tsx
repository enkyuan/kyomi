import React from "react";
import type { ReaderContent, ReaderLayoutMode, ReaderPreferences } from "../core";
import { createReaderDocument } from "../webview";

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

import { requireNativeView } from "expo";
import type { ArticleListViewProps } from "./types";

const NativeArticleListView = requireNativeView<ArticleListViewProps>("ArticleList");

export function ArticleListView(props: ArticleListViewProps) {
  return <NativeArticleListView {...props} />;
}

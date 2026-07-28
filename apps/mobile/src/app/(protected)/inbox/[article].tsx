import { useLocalSearchParams } from "expo-router";
import { ReaderScreen } from "@modules/reader/components/screen";

export default function ArticleRoute() {
  const { article } = useLocalSearchParams<{ article: string }>();
  return <ReaderScreen articleId={article} />;
}

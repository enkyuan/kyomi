import { Text, View } from "react-native";

export type ReaderScreenProps = {
  readonly articleId: string;
};

export function ReaderScreen({ articleId }: ReaderScreenProps) {
  return (
    <View className="flex-1 bg-background p-4">
      <Text className="text-xl font-semibold text-foreground">Article</Text>
      <Text className="mt-1 text-xs text-muted-foreground">{articleId}</Text>
    </View>
  );
}

import { Pressable, Text } from "react-native";
import type { InboxPreviewItem } from "@modules/inbox/model";

export type InboxRowProps = {
  readonly item: InboxPreviewItem;
  readonly selected: boolean;
  readonly onSelect: (id: string) => void;
};

export function InboxRow({ item, selected, onSelect }: InboxRowProps) {
  return (
    <Pressable
      onPress={() => onSelect(item.id)}
      className={`px-4 py-3${selected ? " bg-matcha/12" : ""}`}
    >
      <Text className="text-xs text-muted-foreground">{item.source}</Text>
      <Text className="text-base font-semibold text-foreground">{item.title}</Text>
      <Text className="text-sm text-muted-foreground" numberOfLines={2}>
        {item.summary}
      </Text>
    </Pressable>
  );
}

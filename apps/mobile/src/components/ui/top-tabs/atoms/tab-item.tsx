import { Platform, Pressable, Text, useColorScheme } from "react-native";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

type Props = {
  name: string;
  isFocused: boolean;
  onPress: () => void;
  onLayout: (width: number) => void;
  className: string;
};

/**
 * Uses a normal native Text node so the label remains in React Native's
 * rendering tree while the pager and indicator continue on the UI runtime.
 */
export function TabItem({ name, isFocused, onPress, onLayout, className }: Props) {
  const { foreground, mutedForeground } = getMobileSurfaceTheme(useColorScheme());

  return (
    <Pressable
      accessibilityLabel={name}
      accessibilityRole={Platform.OS === "ios" ? "button" : "tab"}
      accessibilityState={{ selected: isFocused }}
      className="items-center justify-center rounded-full px-1 py-2"
      onLayout={(event) => onLayout(event.nativeEvent.layout.width)}
      onPress={onPress}
    >
      <Text className={className} style={{ color: isFocused ? foreground : mutedForeground }}>
        {name}
      </Text>
    </Pressable>
  );
}

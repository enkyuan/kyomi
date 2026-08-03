import { Host } from "@expo/ui";
import { ScrollView, VStack } from "@expo/ui/swift-ui";
import { background, frame, font, padding, tint } from "@expo/ui/swift-ui/modifiers";
import { Platform, useColorScheme } from "react-native";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

const FULL_WIDTH = frame({ maxWidth: Infinity });

export function RecentsScreen() {
  const theme = getMobileSurfaceTheme(useColorScheme());

  return (
    <Host style={{ flex: 1 }}>
      <ScrollView
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity }),
          background(theme.background),
        ]}
        showsIndicators={false}
      >
        <VStack
          spacing={12}
          modifiers={[frame({ maxWidth: Infinity }), padding({ horizontal: 24, vertical: 16 })]}
        >
          <></>
        </VStack>
      </ScrollView>
    </Host>
  );
}

import { Host, RNHostView } from "@expo/ui";
import { Button, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  background,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  multilineTextAlignment,
  padding,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useState } from "react";
import { useColorScheme } from "react-native";
import { AppleIcon, GoogleIcon, KyomiIcon } from "@/components/icons";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { EmailSheet } from "@modules/auth/email/screen";

const FULL_WIDTH = [frame({ maxWidth: Infinity })];
const ICON_SLOT = [frame({ maxWidth: Infinity, alignment: "leading" }), padding({ leading: 20 })];
const CENTERED_LABEL = [frame({ maxWidth: Infinity, alignment: "center" })];
const LABEL_FONT = font({ weight: "semibold", size: 18 });

export function InitScreen() {
  const theme = getMobileSurfaceTheme(useColorScheme());
  const [isEmailSheetOpen, setIsEmailSheetOpen] = useState(false);

  return (
    <Host style={{ flex: 1 }}>
      <VStack
        spacing={0}
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity }),
          padding({ horizontal: 24, vertical: 40 }),
          background(theme.background),
        ]}
      >
        <Spacer />

        <RNHostView matchContents>
          <KyomiIcon size={48} />
        </RNHostView>

        <Text
          modifiers={[
            padding({ top: 24 }),
            multilineTextAlignment("center"),
            lineLimit(2),
            font({ size: 24, weight: "semibold" }),
            foregroundStyle(theme.foreground),
          ]}
        >
          {"Find your interests.\nAll your feeds, one spot."}
        </Text>

        <Spacer modifiers={[frame({ maxHeight: 48 })]} />

        <VStack spacing={12}>
          <Button
            onPress={() => setIsEmailSheetOpen(true)}
            modifiers={[
              buttonStyle("glassProminent"),
              buttonBorderShape("capsule"),
              tint("#a8d480"),
              padding({ vertical: 2 }),
              controlSize("extraLarge"),
              ...FULL_WIDTH,
            ]}
          >
            <ZStack alignment="leading" modifiers={FULL_WIDTH}>
              <Text modifiers={[...CENTERED_LABEL, LABEL_FONT, foregroundStyle(theme.background)]}>
                Continue with email
              </Text>
            </ZStack>
          </Button>

          <Button
            onPress={() => {}}
            modifiers={[
              buttonStyle("glass"),
              buttonBorderShape("capsule"),
              padding({ vertical: 2 }),
              controlSize("extraLarge"),
              ...FULL_WIDTH,
            ]}
          >
            <ZStack alignment="leading" modifiers={FULL_WIDTH}>
              <RNHostView matchContents modifiers={ICON_SLOT}>
                <GoogleIcon size={20} />
              </RNHostView>
              <Text modifiers={[...CENTERED_LABEL, LABEL_FONT]}>Continue with Google</Text>
            </ZStack>
          </Button>

          <Button
            onPress={() => {}}
            modifiers={[
              buttonStyle("glass"),
              buttonBorderShape("capsule"),
              padding({ vertical: 2 }),
              controlSize("extraLarge"),
              ...FULL_WIDTH,
            ]}
          >
            <ZStack alignment="leading" modifiers={FULL_WIDTH}>
              <RNHostView matchContents modifiers={ICON_SLOT}>
                <AppleIcon size={24} fill={theme.foreground} />
              </RNHostView>
              <Text modifiers={[...CENTERED_LABEL, LABEL_FONT]}>Continue with Apple</Text>
            </ZStack>
          </Button>
        </VStack>
      </VStack>

      <EmailSheet
        isPresented={isEmailSheetOpen}
        onDismiss={() => setIsEmailSheetOpen(false)}
        theme={theme}
      />
    </Host>
  );
}

import { Host, RNHostView } from "@expo/ui";
import { Box, Button, Column, Shape, Spacer, Text } from "@expo/ui/jetpack-compose";
import {
  align,
  background,
  fillMaxSize,
  fillMaxWidth,
  padding,
  paddingAll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";
import { useColorScheme } from "react-native";
import { AppleIcon, GoogleIcon, KyomiIcon } from "@/components/icons";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { EmailSheet } from "@modules/auth/email/screen";

const ICON_SLOT = [align("centerStart"), padding(20, 0, 0, 0)];

const BUTTON_LABEL_STYLE = { fontSize: 18, fontWeight: "600" as const };

export function InitScreen() {
  const theme = getMobileSurfaceTheme(useColorScheme());
  const buttonColors = { containerColor: theme.card, contentColor: theme.foreground };
  const [isEmailSheetOpen, setIsEmailSheetOpen] = useState(false);

  return (
    <Host style={{ flex: 1 }}>
      <Column
        horizontalAlignment="center"
        modifiers={[fillMaxSize(), background(theme.background), paddingAll(24)]}
      >
        <Spacer modifiers={[weight(1)]} />

        <RNHostView matchContents>
          <KyomiIcon size={64} />
        </RNHostView>

        <Text
          color={theme.foreground}
          style={{ fontSize: 30, fontWeight: "600", textAlign: "center" }}
        >
          {"Your reading inbox.\nAll your feeds, one place."}
        </Text>

        <Spacer modifiers={[weight(1)]} />

        <Column verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth()]}>
          <Button
            onClick={() => setIsEmailSheetOpen(true)}
            shape={Shape.Pill({})}
            colors={buttonColors}
            contentPadding={{ top: 14, bottom: 14 }}
            modifiers={[fillMaxWidth()]}
          >
            <Box modifiers={[fillMaxWidth()]}>
              <Text style={BUTTON_LABEL_STYLE} modifiers={[align("center")]}>
                Continue with email
              </Text>
            </Box>
          </Button>

          <Button
            onClick={() => {}}
            shape={Shape.Pill({})}
            colors={buttonColors}
            contentPadding={{ top: 14, bottom: 14 }}
            modifiers={[fillMaxWidth()]}
          >
            <Box modifiers={[fillMaxWidth()]}>
              <RNHostView matchContents modifiers={ICON_SLOT}>
                <GoogleIcon size={20} />
              </RNHostView>
              <Text style={BUTTON_LABEL_STYLE} modifiers={[align("center")]}>
                Continue with Google
              </Text>
            </Box>
          </Button>

          <Button
            onClick={() => {}}
            shape={Shape.Pill({})}
            colors={buttonColors}
            contentPadding={{ top: 14, bottom: 14 }}
            modifiers={[fillMaxWidth()]}
          >
            <Box modifiers={[fillMaxWidth()]}>
              <RNHostView matchContents modifiers={ICON_SLOT}>
                <AppleIcon size={24} fill={theme.foreground} />
              </RNHostView>
              <Text style={BUTTON_LABEL_STYLE} modifiers={[align("center")]}>
                Continue with Apple
              </Text>
            </Box>
          </Button>
        </Column>
      </Column>

      <EmailSheet
        isPresented={isEmailSheetOpen}
        onDismiss={() => setIsEmailSheetOpen(false)}
        theme={theme}
      />
    </Host>
  );
}

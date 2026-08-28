import { Button, Column, Host, Spacer, Text } from "@expo/ui";
import { useState } from "react";
import { useColorScheme, View } from "react-native";
import { AppleIcon, GoogleIcon, KyomiIcon } from "@/components/icons";
import { FONT_STYLES } from "@/theme/fonts";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { EmailSheet } from "@modules/auth/email/screen";

function ButtonLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={{ width: "100%", justifyContent: "center" }}>
      <View style={{ position: "absolute", left: 20 }}>{icon}</View>
      <Text textStyle={FONT_STYLES.button}>{label}</Text>
    </View>
  );
}

export function InitScreen() {
  const theme = getMobileSurfaceTheme(useColorScheme());
  const [isEmailSheetOpen, setIsEmailSheetOpen] = useState(false);

  return (
    <Host style={{ flex: 1, backgroundColor: theme.background }}>
      <Column alignment="center" style={{ width: "100%", height: "100%" }}>
        <Spacer flexible />

        <KyomiIcon size={64} />

        <Text textStyle={{ ...FONT_STYLES.hero, color: theme.foreground, textAlign: "center" }}>
          {"Your reading inbox.\nAll your feeds, one place."}
        </Text>

        <Spacer flexible />

        <Column spacing={12} style={{ width: "100%" }}>
          <Button
            variant="outlined"
            style={{ width: "100%", backgroundColor: theme.card }}
            onPress={() => setIsEmailSheetOpen(true)}
          >
            <Text textStyle={{ ...FONT_STYLES.button, textAlign: "center" }}>
              Continue with email
            </Text>
          </Button>
          <Button
            variant="outlined"
            style={{ width: "100%", backgroundColor: theme.card }}
            onPress={() => {}}
          >
            <ButtonLabel icon={<GoogleIcon size={20} />} label="Continue with Google" />
          </Button>
          <Button
            variant="outlined"
            style={{ width: "100%", backgroundColor: theme.card }}
            onPress={() => {}}
          >
            <ButtonLabel
              icon={<AppleIcon size={24} fill={theme.foreground} />}
              label="Continue with Apple"
            />
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

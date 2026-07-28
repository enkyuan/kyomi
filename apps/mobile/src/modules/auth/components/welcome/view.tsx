import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GoogleIcon, KyomiIcon } from "@/components/icons";

import type { AuthActionModel, AuthWelcomeModel } from "../model";
import { authLayoutTokens, authWelcomeColors, resolveAuthPanelRadius } from "../tokens";

function WelcomeAction({
  action,
  kind,
  accessibilityHint,
}: {
  action: AuthActionModel;
  kind: "google" | "email";
  accessibilityHint?: string;
}) {
  const baseClass =
    "flex-row items-center justify-center gap-2 rounded-[14px] min-h-[50px] px-[18px]";
  const kindClass = kind === "email" ? "bg-[#ececec]" : "bg-white";

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled: !action.enabled }}
      className={`${baseClass} ${kindClass}`}
      disabled={!action.enabled}
      onPress={action.onPress}
      style={({ pressed }) => [
        kind === "google" ? styles.googleBorder : null,
        pressed && action.enabled ? styles.pressed : null,
        !action.enabled ? styles.disabled : null,
      ]}
    >
      {kind === "google" ? <GoogleIcon size={18} /> : null}
      <Text className="text-[#171717] text-[15px] font-sans-semibold">{action.label}</Text>
    </Pressable>
  );
}

export function AuthWelcomeView({ model }: { model: AuthWelcomeModel }) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const panelRadius = resolveAuthPanelRadius(windowWidth);

  return (
    <SafeAreaView className="flex-1 bg-black" edges={["top", "left", "right"]}>
      <ScrollView
        className="bg-black"
        contentContainerClassName="flex-grow bg-black"
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 min-h-[220px] items-center justify-center px-6 py-12">
          <View className="flex-row items-center gap-[10px]">
            <KyomiIcon size={authLayoutTokens.heroMarkSize} />
            <Text className="text-white text-[32px] font-sans-bold tracking-[-0.8px]">
              {model.wordmark}
            </Text>
          </View>
        </View>

        <View
          className="items-center bg-white mx-[6px] mb-[6px] px-6 pt-6"
          style={{
            borderRadius: panelRadius,
            paddingBottom: authLayoutTokens.panelBottomPadding + insets.bottom,
          }}
        >
          <View className="gap-5 max-w-[440px] w-full">
            <View className="items-center justify-center self-start bg-[#f2f2f2] rounded-full h-9 w-9">
              <KyomiIcon size={authLayoutTokens.panelBadgeMarkSize} />
            </View>

            <View className="gap-1.5">
              <Text
                accessibilityRole="header"
                className="text-[#171717] text-2xl font-sans-bold tracking-[-0.4px]"
              >
                {model.title}
              </Text>
              <Text className="text-[#6e6e73] text-base leading-[23px]" numberOfLines={2}>
                {model.description}
              </Text>
            </View>

            <View className="gap-[10px]">
              <WelcomeAction
                accessibilityHint={model.googleUnavailableMessage}
                action={model.google}
                kind="google"
              />
              <WelcomeAction action={model.email} kind="email" />
            </View>

            <Text className="text-[#8a8a8a] text-xs leading-4">{model.legalText}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  googleBorder: {
    borderColor: "#dadce0",
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.56,
  },
});

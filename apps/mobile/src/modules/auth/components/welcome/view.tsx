import { kyomiNativeColors } from "@kyomi/ui/native/theme";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GoogleIcon, KyomiIcon } from "@/components/icons";

import type { AuthActionModel, AuthWelcomeModel } from "../model";
import {
  authFallbackColors,
  authLayoutTokens,
  authWelcomeColors,
  resolveAuthPanelRadius,
} from "../tokens";

function actionStyle(
  kind: "google" | "email",
  pressed: boolean,
  enabled: boolean,
): StyleProp<ViewStyle> {
  return [
    styles.action,
    kind === "email" ? styles.emailAction : styles.googleAction,
    pressed && enabled ? styles.pressed : null,
    !enabled ? styles.disabled : null,
  ];
}

function WelcomeAction({
  action,
  kind,
  accessibilityHint,
}: {
  action: AuthActionModel;
  kind: "google" | "email";
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled: !action.enabled }}
      disabled={!action.enabled}
      onPress={action.onPress}
      style={({ pressed }) => actionStyle(kind, pressed, action.enabled)}
    >
      {kind === "google" ? <GoogleIcon size={18} /> : null}
      <Text style={styles.actionText}>{action.label}</Text>
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
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.brand}>
            <KyomiIcon size={authLayoutTokens.heroMarkSize} />
            <Text style={styles.wordmark}>{model.wordmark}</Text>
          </View>
        </View>

        <View
          style={[
            styles.panel,
            {
              borderRadius: panelRadius,
              paddingBottom: authLayoutTokens.panelBottomPadding + insets.bottom,
            },
          ]}
        >
          <View style={styles.content}>
            <View style={styles.badge}>
              <KyomiIcon size={authLayoutTokens.panelBadgeMarkSize} />
            </View>

            <View style={styles.heading}>
              <Text accessibilityRole="header" style={styles.title}>
                {model.title}
              </Text>
              <Text numberOfLines={2} style={styles.description}>
                {model.description}
              </Text>
            </View>

            <View style={styles.actions}>
              <WelcomeAction
                accessibilityHint={model.googleUnavailableMessage}
                action={model.google}
                kind="google"
              />
              <WelcomeAction action={model.email} kind="email" />
            </View>

            <Text style={styles.legal}>{model.legalText}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    backgroundColor: kyomiNativeColors.black,
    flexGrow: 1,
  },
  hero: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 220,
    paddingHorizontal: authLayoutTokens.screenHorizontalPadding,
    paddingVertical: 48,
  },
  brand: {
    alignItems: "center",
    flexDirection: "row",
    gap: authLayoutTokens.brandGap,
  },
  wordmark: {
    color: authFallbackColors.text,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  panel: {
    alignItems: "center",
    backgroundColor: authWelcomeColors.panel,
    marginBottom: authLayoutTokens.panelScreenInset,
    marginHorizontal: authLayoutTokens.panelScreenInset,
    paddingHorizontal: authLayoutTokens.panelHorizontalPadding,
    paddingTop: authLayoutTokens.panelTopPadding,
  },
  content: {
    gap: authLayoutTokens.contentGap,
    maxWidth: authLayoutTokens.contentMaxWidth,
    width: "100%",
  },
  badge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: authWelcomeColors.badgeSurface,
    borderRadius: authLayoutTokens.panelBadgeSize / 2,
    height: authLayoutTokens.panelBadgeSize,
    justifyContent: "center",
    width: authLayoutTokens.panelBadgeSize,
  },
  heading: {
    gap: 6,
  },
  title: {
    color: authWelcomeColors.text,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  description: {
    color: authWelcomeColors.mutedText,
    fontSize: 16,
    lineHeight: 23,
  },
  actions: {
    gap: authLayoutTokens.actionGap,
  },
  action: {
    alignItems: "center",
    borderRadius: authLayoutTokens.controlRadius,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: authLayoutTokens.controlMinHeight,
    paddingHorizontal: 18,
  },
  emailAction: {
    backgroundColor: authWelcomeColors.emailSurface,
  },
  googleAction: {
    backgroundColor: authWelcomeColors.googleSurface,
    borderColor: authWelcomeColors.googleOutline,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionText: {
    color: authWelcomeColors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.56,
  },
  legal: {
    color: authWelcomeColors.legalText,
    fontSize: 12,
    lineHeight: 16,
  },
});

import { kyomiNativeBrand, kyomiNativeColors } from "@kyomi/ui/native/theme";
import { Host } from "@expo/ui";
import { Button, HStack, RNHostView, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  accessibilityHint,
  background,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  environment,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  shapes,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GoogleLogoMark } from "@/components/google-logo-mark";
import { KyomiLogoMark } from "@/components/kyomi-logo-mark";

import type { AuthActionModel, AuthWelcomeModel } from "../model";
import {
  authLayoutTokens,
  authWelcomeColors,
  resolveAuthPanelRadius,
} from "../tokens";

function WelcomeAction({
  action,
  kind,
  accessibilityDescription,
}: {
  action: AuthActionModel;
  kind: "google" | "email";
  accessibilityDescription?: string;
}) {
  const isGoogle = kind === "google";

  return (
    <Button
      modifiers={[
        buttonStyle(isGoogle ? "bordered" : "borderedProminent"),
        buttonBorderShape("roundedRectangle", authLayoutTokens.controlRadius),
        controlSize("large"),
        frame({
          minHeight: authLayoutTokens.controlMinHeight,
          maxWidth: Infinity,
        }),
        tint(isGoogle ? authWelcomeColors.text : authWelcomeColors.emailSurface),
        disabled(!action.enabled),
        ...(accessibilityDescription ? [accessibilityHint(accessibilityDescription)] : []),
      ]}
      onPress={action.onPress}
    >
      <HStack alignment="center" spacing={8}>
        {isGoogle ? (
          <RNHostView matchContents>
            <GoogleLogoMark size={18} />
          </RNHostView>
        ) : null}
        <Text
          modifiers={[
            font({ textStyle: "body", weight: "semibold" }),
            foregroundStyle(authWelcomeColors.text),
          ]}
        >
          {action.label}
        </Text>
      </HStack>
    </Button>
  );
}

export function AuthWelcomeView({ model }: { model: AuthWelcomeModel }) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const panelRadius = resolveAuthPanelRadius(windowWidth);

  return (
    <SafeAreaView className="flex-1 bg-black" edges={["top", "left", "right"]}>
      <Host
        colorScheme="dark"
        seedColor={kyomiNativeBrand.matcha.color}
        style={{ flex: 1 }}
        useViewportSizeMeasurement
      >
        <VStack
          modifiers={[
            frame({ minHeight: 0, maxWidth: Infinity, maxHeight: Infinity }),
            background(kyomiNativeColors.black),
          ]}
          spacing={0}
        >
          <VStack
            alignment="center"
            modifiers={[frame({ minHeight: 180, maxWidth: Infinity, maxHeight: Infinity })]}
          >
            <Spacer />
            <HStack alignment="center" spacing={authLayoutTokens.brandGap}>
              <RNHostView matchContents>
                <KyomiLogoMark size={authLayoutTokens.heroMarkSize} />
              </RNHostView>
              <Text modifiers={[font({ textStyle: "largeTitle", weight: "bold" })]}>
                {model.wordmark}
              </Text>
            </HStack>
            <Spacer />
          </VStack>

          <VStack
            modifiers={[
              frame({ maxWidth: Infinity }),
              padding({
                leading: authLayoutTokens.panelScreenInset,
                trailing: authLayoutTokens.panelScreenInset,
                bottom: authLayoutTokens.panelScreenInset,
              }),
            ]}
          >
            <VStack
              alignment="center"
              modifiers={[
                frame({ maxWidth: Infinity }),
                background(
                  authWelcomeColors.panel,
                  shapes.roundedRectangle({
                    cornerRadius: panelRadius,
                    roundedCornerStyle: "continuous",
                  }),
                ),
                environment({ key: "colorScheme", value: "light" }),
              ]}
            >
              <VStack
                alignment="leading"
                modifiers={[
                  frame({
                    maxWidth: authLayoutTokens.contentMaxWidth,
                    alignment: "leading",
                  }),
                  padding({
                    top: authLayoutTokens.panelTopPadding,
                    leading: authLayoutTokens.panelHorizontalPadding,
                    trailing: authLayoutTokens.panelHorizontalPadding,
                    bottom: authLayoutTokens.panelBottomPadding + insets.bottom,
                  }),
                ]}
                spacing={authLayoutTokens.contentGap}
              >
                <ZStack
                  modifiers={[
                    frame({
                      width: authLayoutTokens.panelBadgeSize,
                      height: authLayoutTokens.panelBadgeSize,
                    }),
                    background(authWelcomeColors.badgeSurface, shapes.circle()),
                  ]}
                >
                  <RNHostView matchContents>
                    <KyomiLogoMark size={authLayoutTokens.panelBadgeMarkSize} />
                  </RNHostView>
                </ZStack>

                <VStack alignment="leading" spacing={6}>
                  <Text
                    modifiers={[
                      font({ textStyle: "title2", weight: "bold" }),
                      foregroundStyle(authWelcomeColors.text),
                    ]}
                  >
                    {model.title}
                  </Text>
                  <Text
                    modifiers={[
                      font({ textStyle: "body" }),
                      foregroundStyle(authWelcomeColors.mutedText),
                      lineLimit(2),
                    ]}
                  >
                    {model.description}
                  </Text>
                </VStack>

                <VStack alignment="leading" spacing={authLayoutTokens.actionGap}>
                  <WelcomeAction
                    accessibilityDescription={model.googleUnavailableMessage}
                    action={model.google}
                    kind="google"
                  />
                  <WelcomeAction action={model.email} kind="email" />
                </VStack>

                <Text
                  modifiers={[
                    font({ textStyle: "caption" }),
                    foregroundStyle(authWelcomeColors.legalText),
                  ]}
                >
                  {model.legalText}
                </Text>
              </VStack>
            </VStack>
          </VStack>
        </VStack>
      </Host>
    </SafeAreaView>
  );
}

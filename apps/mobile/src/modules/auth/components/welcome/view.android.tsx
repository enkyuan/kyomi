import { kyomiNativeBrand, kyomiNativeColors } from "@kyomi/ui/native/theme";
import { Host } from "@expo/ui";
import {
  Button,
  Column,
  OutlinedButton,
  RNHostView,
  Row,
  Shape,
  Surface,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  align,
  background,
  defaultMinSize,
  fillMaxSize,
  fillMaxWidth,
  padding,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
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

function roundedCornerShape(radius: number) {
  return Shape.RoundedCorner({
    cornerRadii: {
      topStart: radius,
      topEnd: radius,
      bottomStart: radius,
      bottomEnd: radius,
    },
  });
}

function WelcomeAction({ action, kind }: { action: AuthActionModel; kind: "google" | "email" }) {
  const isGoogle = kind === "google";
  const Action = isGoogle ? OutlinedButton : Button;

  return (
    <Action
      colors={{
        containerColor: isGoogle
          ? authWelcomeColors.googleSurface
          : authWelcomeColors.emailSurface,
        contentColor: authWelcomeColors.text,
        disabledContainerColor: isGoogle
          ? authWelcomeColors.googleSurface
          : authWelcomeColors.emailSurface,
        disabledContentColor: authWelcomeColors.mutedText,
      }}
      enabled={action.enabled}
      modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: authLayoutTokens.controlMinHeight })]}
      onClick={action.onPress}
      shape={roundedCornerShape(authLayoutTokens.controlRadius)}
    >
      <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center">
        {isGoogle ? (
          <RNHostView matchContents>
            <GoogleLogoMark size={18} />
          </RNHostView>
        ) : null}
        <Text
          color={action.enabled ? authWelcomeColors.text : authWelcomeColors.mutedText}
          style={{ typography: "labelLarge" }}
        >
          {action.label}
        </Text>
      </Row>
    </Action>
  );
}

function WelcomeContent({ model }: { model: AuthWelcomeModel }) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const panelRadius = resolveAuthPanelRadius(windowWidth);
  const contentFraction = Math.min(
    1,
    authLayoutTokens.contentMaxWidth /
      Math.max(
        windowWidth -
          authLayoutTokens.panelHorizontalPadding * 2 -
          authLayoutTokens.panelScreenInset * 2,
        1,
      ),
  );

  return (
    <Column
      modifiers={[fillMaxSize(), background(kyomiNativeColors.black)]}
      verticalArrangement="top"
    >
      <Column
        horizontalAlignment="center"
        modifiers={[fillMaxWidth(), weight(1)]}
        verticalArrangement="center"
      >
        <Row
          horizontalArrangement={{ spacedBy: authLayoutTokens.brandGap }}
          verticalAlignment="center"
        >
          <RNHostView matchContents>
            <KyomiLogoMark size={authLayoutTokens.heroMarkSize} />
          </RNHostView>
          <Text color="#ffffff" style={{ typography: "headlineLarge", fontWeight: "700" }}>
            {model.wordmark}
          </Text>
        </Row>
      </Column>

      <Column
        modifiers={[
          fillMaxWidth(),
          padding(
            authLayoutTokens.panelScreenInset,
            0,
            authLayoutTokens.panelScreenInset,
            authLayoutTokens.panelScreenInset,
          ),
        ]}
      >
        <Surface
          color={authWelcomeColors.panel}
          contentColor={authWelcomeColors.text}
          modifiers={[fillMaxWidth()]}
          shape={roundedCornerShape(panelRadius)}
        >
          <Column horizontalAlignment="center" modifiers={[fillMaxWidth()]}>
            <Column
              horizontalAlignment="start"
              modifiers={[
                fillMaxWidth(contentFraction),
                align("centerHorizontally"),
                padding(
                  authLayoutTokens.panelHorizontalPadding,
                  authLayoutTokens.panelTopPadding,
                  authLayoutTokens.panelHorizontalPadding,
                  authLayoutTokens.panelBottomPadding + insets.bottom,
                ),
              ]}
              verticalArrangement={{ spacedBy: authLayoutTokens.contentGap }}
            >
              <Surface
                color={authWelcomeColors.badgeSurface}
                contentColor={authWelcomeColors.text}
                modifiers={[
                  defaultMinSize({
                    minWidth: authLayoutTokens.panelBadgeSize,
                    minHeight: authLayoutTokens.panelBadgeSize,
                  }),
                ]}
                shape={Shape.Circle({})}
              >
                <Row
                  horizontalArrangement="center"
                  modifiers={[
                    defaultMinSize({
                      minWidth: authLayoutTokens.panelBadgeSize,
                      minHeight: authLayoutTokens.panelBadgeSize,
                    }),
                  ]}
                  verticalAlignment="center"
                >
                  <RNHostView matchContents>
                    <KyomiLogoMark size={authLayoutTokens.panelBadgeMarkSize} />
                  </RNHostView>
                </Row>
              </Surface>

              <Column verticalArrangement={{ spacedBy: 6 }}>
                <Text
                  color={authWelcomeColors.text}
                  style={{ typography: "headlineSmall", fontWeight: "700" }}
                >
                  {model.title}
                </Text>
                <Text
                  color={authWelcomeColors.mutedText}
                  maxLines={2}
                  style={{ typography: "bodyLarge", lineBreak: "heading" }}
                >
                  {model.description}
                </Text>
              </Column>

              <Column verticalArrangement={{ spacedBy: authLayoutTokens.actionGap }}>
                <WelcomeAction action={model.google} kind="google" />
                <WelcomeAction action={model.email} kind="email" />
              </Column>

              <Text color={authWelcomeColors.legalText} style={{ typography: "labelSmall" }}>
                {model.legalText}
              </Text>
            </Column>
          </Column>
        </Surface>
      </Column>
    </Column>
  );
}

export function AuthWelcomeView({ model }: { model: AuthWelcomeModel }) {
  return (
    <SafeAreaView className="flex-1 bg-black" edges={["top", "left", "right"]}>
      <Host
        colorScheme="light"
        seedColor={kyomiNativeBrand.matcha.color}
        style={{ flex: 1 }}
        useViewportSizeMeasurement
      >
        <WelcomeContent model={model} />
      </Host>
    </SafeAreaView>
  );
}

import {
  BottomSheet,
  Button,
  HStack,
  Image,
  ProgressView,
  Spacer,
  Text,
  type TextFieldRef,
  useNativeState,
  VStack,
  ZStack,
} from "@expo/ui/swift-ui";
import {
  Animation,
  accessibilityHidden,
  accessibilityLabel,
  animation,
  background,
  buttonBorderShape,
  buttonStyle,
  clipShape,
  controlSize,
  font,
  foregroundStyle,
  frame,
  hidden,
  labelStyle,
  padding,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useCallback, useRef } from "react";
import { mobileColors } from "@/theme/colors";
import { EmailFormStep, OTPFormStep, type EmailStepTheme } from "./components/step-content.ios";
import { useEmailAuth } from "./hooks/use-auth";
import { FONT_FAMILIES, FONT_SIZES, SWIFT_FONT_WEIGHTS } from "@/theme/fonts";

const FULL_WIDTH = [frame({ maxWidth: Infinity })];
const CENTERED_LABEL = [frame({ maxWidth: Infinity, alignment: "center" })];
const LABEL_FONT = font({
  family: FONT_FAMILIES.inter.semibold,
  size: FONT_SIZES.button,
  weight: SWIFT_FONT_WEIGHTS.semibold,
});
const STEP_TRANSITION = Animation.easeOut({ duration: 0.24 });
const REDUCED_MOTION_STEP_TRANSITION = Animation.easeOut({ duration: 0.16 });

type Theme = EmailStepTheme;

export type EmailSheetProps = {
  isPresented: boolean;
  onDismiss: () => void;
  theme: Theme;
};

export function EmailSheet({ isPresented, onDismiss, theme }: EmailSheetProps) {
  const email = useNativeState("");
  const otp = useNativeState("");
  const emailFieldRef = useRef<TextFieldRef>(null);
  const otpFieldRef = useRef<TextFieldRef>(null);
  const focusEmail = useCallback(() => emailFieldRef.current?.focus(), []);
  const focusOtp = useCallback(() => otpFieldRef.current?.focus(), []);
  const {
    errorMessage,
    handleDismiss,
    handleEmailChange,
    handleErrorAlertChange,
    handleOtpChange,
    handleSendCode,
    handleUseDifferentEmail,
    handleVerifyCode,
    isEmailInvalid,
    isEmailStep,
    isOtpInvalid,
    isSubmitting,
    otpValue,
    shouldReduceMotion,
    showErrorAlert,
  } = useEmailAuth({ email, focusEmail, focusOtp, isPresented, onDismiss, otp });

  return (
    <BottomSheet
      isPresented={isPresented}
      onIsPresentedChange={(open) => !open && handleDismiss()}
      fitToContents
    >
      <BottomSheet.Overlay>
        <Button
          label="Close"
          systemImage="xmark"
          onPress={handleDismiss}
          modifiers={[
            buttonStyle("bordered"),
            buttonBorderShape("circle"),
            controlSize("regular"),
            labelStyle("iconOnly"),
            accessibilityLabel("Close"),
            foregroundStyle(theme.foreground),
            font({ weight: SWIFT_FONT_WEIGHTS.semibold }),
          ]}
        />
      </BottomSheet.Overlay>

      <VStack modifiers={FULL_WIDTH}>
        <HStack modifiers={[...FULL_WIDTH, padding({ top: 18, trailing: 18 })]}>
          <Spacer />
          <Button
            label="Close"
            systemImage="xmark"
            onPress={handleDismiss}
            modifiers={[
              buttonStyle("bordered"),
              buttonBorderShape("circle"),
              controlSize("regular"),
              labelStyle("iconOnly"),
              accessibilityHidden(true),
              hidden(),
            ]}
          />
        </HStack>

        <VStack alignment="leading" modifiers={[...FULL_WIDTH, padding({ horizontal: 24 })]}>
          <ZStack
            modifiers={[
              frame({ width: 64, height: 64 }),
              background(theme.input),
              clipShape("circle"),
            ]}
          >
            <Image
              systemName="envelope"
              modifiers={[
                font({
                  family: FONT_FAMILIES.inter.semibold,
                  size: FONT_SIZES.screenTitle,
                  weight: SWIFT_FONT_WEIGHTS.semibold,
                }),
                foregroundStyle(theme.foreground),
              ]}
            />
          </ZStack>

          <VStack
            modifiers={[
              ...FULL_WIDTH,
              animation(
                shouldReduceMotion ? REDUCED_MOTION_STEP_TRANSITION : STEP_TRANSITION,
                isEmailStep,
              ),
            ]}
          >
            <ZStack alignment="topLeading" modifiers={FULL_WIDTH}>
              <EmailFormStep
                active={isEmailStep}
                email={email}
                emailFieldRef={emailFieldRef}
                errorAlertPresented={showErrorAlert && isEmailInvalid}
                errorMessage={isEmailInvalid ? errorMessage : null}
                invalid={isEmailInvalid}
                onEmailChange={handleEmailChange}
                onErrorAlertChange={handleErrorAlertChange}
                onSubmit={handleSendCode}
                theme={theme}
              />
              <OTPFormStep
                active={!isEmailStep}
                errorAlertPresented={showErrorAlert && isOtpInvalid}
                errorMessage={isOtpInvalid ? errorMessage : null}
                invalid={isOtpInvalid}
                onErrorAlertChange={handleErrorAlertChange}
                onFocusOtp={focusOtp}
                onOtpChange={handleOtpChange}
                onSubmit={() =>
                  otpValue.length === 6 ? handleVerifyCode(otpValue) : handleSendCode()
                }
                otp={otp}
                otpFieldRef={otpFieldRef}
                otpValue={otpValue}
                theme={theme}
              />
            </ZStack>

            {!isEmailStep ? (
              <Button
                onPress={handleUseDifferentEmail}
                modifiers={[buttonStyle("plain"), padding({ top: 16 }), ...FULL_WIDTH]}
              >
                <ZStack modifiers={FULL_WIDTH}>
                  <Text
                    modifiers={[...CENTERED_LABEL, LABEL_FONT, foregroundStyle(theme.foreground)]}
                  >
                    Use a different email
                  </Text>
                </ZStack>
              </Button>
            ) : null}
          </VStack>

          <Button
            onPress={
              isEmailStep
                ? handleSendCode
                : otpValue.length === 6
                  ? () => handleVerifyCode(otpValue)
                  : handleSendCode
            }
            modifiers={[
              buttonStyle("glassProminent"),
              buttonBorderShape("capsule"),
              tint(mobileColors.matcha),
              padding({ top: 18 }),
              controlSize("extraLarge"),
              ...FULL_WIDTH,
            ]}
          >
            <ZStack modifiers={[...FULL_WIDTH, frame({ height: 22 })]}>
              {isSubmitting ? (
                <ProgressView
                  modifiers={[
                    tint(theme.background),
                    controlSize("regular"),
                    frame({ width: 20, height: 20 }),
                  ]}
                />
              ) : (
                <Text
                  modifiers={[...CENTERED_LABEL, LABEL_FONT, foregroundStyle(theme.background)]}
                >
                  {isEmailStep || otpValue.length === 6 ? "Continue" : "Resend email"}
                </Text>
              )}
            </ZStack>
          </Button>
        </VStack>
      </VStack>
    </BottomSheet>
  );
}

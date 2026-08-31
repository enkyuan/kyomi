import {
  Alert,
  Button,
  HStack,
  Text,
  TextField,
  type TextFieldRef,
  VStack,
  ZStack,
  type useNativeState,
} from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  accessibilityHint,
  accessibilityLabel,
  autocorrectionDisabled,
  background,
  clipShape,
  disabled,
  font,
  foregroundStyle,
  frame,
  keyboardType,
  onSubmit as onSubmitModifier,
  onTapGesture,
  opacity,
  padding,
  strokeBorder,
  submitLabel,
  textContentType,
  textFieldStyle,
  textInputAutocapitalization,
  buttonStyle,
} from "@expo/ui/swift-ui/modifiers";
import type { RefObject } from "react";
import { mobileColors } from "@/theme/colors";
import { OTP_SLOTS } from "../constants";
import { FONT_FAMILIES, FONT_SIZES, SWIFT_FONT_WEIGHTS } from "@/theme/fonts";

const FULL_WIDTH = [frame({ maxWidth: Infinity })];

export type EmailStepTheme = { background: string; foreground: string; input: string };
type ObservableStringState = ReturnType<typeof useNativeState<string>>;

type EmailFormStepProps = {
  active: boolean;
  email: ObservableStringState;
  emailFieldRef: RefObject<TextFieldRef | null>;
  errorAlertPresented: boolean;
  errorMessage?: string | null;
  invalid: boolean;
  onEmailChange: (value: string) => void;
  onErrorAlertChange: (isPresented: boolean) => void;
  onSubmit: () => void;
  theme: EmailStepTheme;
};

export function EmailFormStep({
  active,
  email,
  emailFieldRef,
  errorAlertPresented,
  errorMessage,
  invalid,
  onEmailChange,
  onErrorAlertChange,
  onSubmit,
  theme,
}: EmailFormStepProps) {
  return (
    <Alert title="" isPresented={errorAlertPresented} onIsPresentedChange={onErrorAlertChange}>
      <Alert.Trigger>
        <VStack
          alignment="leading"
          modifiers={[
            ...FULL_WIDTH,
            ...(active ? [] : [frame({ height: 0, alignment: "topLeading" })]),
            opacity(active ? 1 : 0),
            disabled(!active),
            accessibilityHidden(!active),
          ]}
        >
          <Text
            modifiers={[
              padding({ top: 20 }),
              font({
                family: FONT_FAMILIES.inter.bold,
                size: FONT_SIZES.screenTitle,
                weight: SWIFT_FONT_WEIGHTS.bold,
              }),
              foregroundStyle(theme.foreground),
            ]}
          >
            Continue with Email
          </Text>

          <Text
            modifiers={[
              padding({ top: 1 }),
              font({
                family: FONT_FAMILIES.inter.medium,
                size: FONT_SIZES.bodyLarge,
                weight: SWIFT_FONT_WEIGHTS.medium,
              }),
              foregroundStyle(theme.foreground),
            ]}
          >
            Sign in or sign up to get started
          </Text>

          <TextField
            ref={emailFieldRef}
            text={email}
            onTextChange={onEmailChange}
            placeholder="you@example.com"
            modifiers={[
              textFieldStyle("plain"),
              keyboardType("email-address"),
              onSubmitModifier(onSubmit),
              submitLabel("done"),
              textContentType("emailAddress"),
              textInputAutocapitalization("never"),
              autocorrectionDisabled(),
              font({ family: FONT_FAMILIES.inter.regular, size: FONT_SIZES.input }),
              foregroundStyle(theme.foreground),
              padding({ horizontal: 20 }),
              ...FULL_WIDTH,
              frame({ height: 52 }),
              background(theme.input),
              clipShape("capsule"),
              accessibilityLabel("Email address"),
              accessibilityHint(
                invalid
                  ? (errorMessage ?? "Check your email address and try again.")
                  : "Enter your email address.",
              ),
              padding({ top: 24 }),
            ]}
          />
        </VStack>
      </Alert.Trigger>
      <Alert.Message>
        <Text>Email entered was invalid</Text>
      </Alert.Message>
      <Alert.Actions>
        <Button label="OK" modifiers={[buttonStyle("borderedProminent")]} />
      </Alert.Actions>
    </Alert>
  );
}

type OTPFormStepProps = {
  active: boolean;
  email: ObservableStringState;
  errorAlertPresented: boolean;
  errorMessage?: string | null;
  invalid: boolean;
  onErrorAlertChange: (isPresented: boolean) => void;
  onFocusOtp: () => void;
  onSubmit: () => void;
  onOtpChange: (value: string) => void;
  otp: ObservableStringState;
  otpFieldRef: RefObject<TextFieldRef | null>;
  otpValue: string;
  theme: EmailStepTheme;
};

export function OTPFormStep({
  active,
  email,
  errorAlertPresented,
  errorMessage,
  invalid,
  onErrorAlertChange,
  onFocusOtp,
  onOtpChange,
  onSubmit,
  otp,
  otpFieldRef,
  otpValue,
  theme,
}: OTPFormStepProps) {
  return (
    <Alert title="" isPresented={errorAlertPresented} onIsPresentedChange={onErrorAlertChange}>
      <Alert.Trigger>
        <VStack
          alignment="leading"
          modifiers={[
            ...FULL_WIDTH,
            ...(active ? [] : [frame({ height: 0, alignment: "topLeading" })]),
            opacity(active ? 1 : 0),
            disabled(!active),
            accessibilityHidden(!active),
          ]}
        >
          <Text
            modifiers={[
              padding({ top: 20 }),
              font({
                family: FONT_FAMILIES.inter.bold,
                size: FONT_SIZES.screenTitle,
                weight: SWIFT_FONT_WEIGHTS.bold,
              }),
              foregroundStyle(theme.foreground),
            ]}
          >
            Enter your Passcode
          </Text>

          <Text
            modifiers={[
              padding({ top: 2 }),
              font({
                family: FONT_FAMILIES.inter.medium,
                size: FONT_SIZES.body,
                weight: SWIFT_FONT_WEIGHTS.medium,
              }),
              foregroundStyle(theme.foreground),
            ]}
          >
            {`Check your inbox for a one-time passcode`}
          </Text>

          <ZStack modifiers={[...FULL_WIDTH, padding({ top: 24 })]}>
            <HStack spacing={10} modifiers={FULL_WIDTH}>
              {OTP_SLOTS.map((slot) => (
                <ZStack
                  key={slot}
                  modifiers={[
                    frame({ maxWidth: Infinity }),
                    frame({ height: 52 }),
                    background(theme.input),
                    clipShape("roundedRectangle", 14),
                    strokeBorder({
                      color: invalid
                        ? mobileColors.validationError
                        : otpValue.length === slot
                          ? mobileColors.matcha
                          : "clear",
                      style: { lineWidth: 2 },
                      shape: "roundedRectangle",
                      cornerRadius: 14,
                    }),
                    onTapGesture(onFocusOtp),
                  ]}
                >
                  <Text
                    modifiers={[
                      font({
                        family: FONT_FAMILIES.inter.semibold,
                        size: FONT_SIZES.otp,
                        weight: SWIFT_FONT_WEIGHTS.semibold,
                      }),
                      foregroundStyle(theme.foreground),
                    ]}
                  >
                    {otpValue[slot] ?? ""}
                  </Text>
                </ZStack>
              ))}
            </HStack>
            <TextField
              ref={otpFieldRef}
              text={otp}
              onTextChange={onOtpChange}
              modifiers={[
                textFieldStyle("plain"),
                keyboardType("numeric"),
                onSubmitModifier(onSubmit),
                submitLabel("done"),
                textContentType("oneTimeCode"),
                textInputAutocapitalization("never"),
                autocorrectionDisabled(),
                accessibilityLabel(
                  invalid ? "Invalid 6-digit verification code" : "6-digit verification code",
                ),
                accessibilityHint(
                  invalid
                    ? (errorMessage ?? "Check every digit and try again.")
                    : "Enter the verification code we sent.",
                ),
                // Keep the native field focusable so iOS can offer one-time-code AutoFill.
                frame({ width: 1, height: 1 }),
                opacity(0),
              ]}
            />
          </ZStack>
        </VStack>
      </Alert.Trigger>
      <Alert.Message>
        <Text>{errorMessage ?? "Enter the 6-digit code and try again."}</Text>
      </Alert.Message>
      <Alert.Actions>
        <Button label="OK" modifiers={[buttonStyle("borderedProminent")]} />
      </Alert.Actions>
    </Alert>
  );
}

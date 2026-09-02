import {
  Alert,
  Button,
  HStack,
  Text,
  TextField,
  VStack,
  ZStack,
  type TextFieldRef,
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
  onSubmit,
  onTapGesture,
  opacity,
  padding,
  strokeBorder,
  submitLabel,
  tint,
  textContentType,
  textFieldStyle,
  textInputAutocapitalization,
} from "@expo/ui/swift-ui/modifiers";
import type { RefObject } from "react";

import { mobileColors } from "@/theme/colors";
import { FONT_FAMILIES, FONT_SIZES, SWIFT_FONT_WEIGHTS } from "@/theme/fonts";

import { OTP_SLOTS } from "../constants";

const FULL_WIDTH = frame({ maxWidth: Infinity });
const ZERO_SIZE = frame({ width: 0, height: 0 });

export type EmailStepTheme = {
  background: string;
  foreground: string;
  input: string;
};

type ObservableStringState = ReturnType<typeof useNativeState<string>>;

function getStepModifiers(active: boolean) {
  return [
    FULL_WIDTH,
    ...(active
      ? []
      : [
          frame({ height: 0, alignment: "topLeading" }),
          opacity(0),
          disabled(),
          accessibilityHidden(),
        ]),
  ];
}

type StepHeaderProps = {
  title: string;
  subtitle: string;
  subtitleSize: number;
  subtitleTopPadding?: number;
  theme: EmailStepTheme;
};

function StepHeader({
  title,
  subtitle,
  subtitleSize,
  subtitleTopPadding = 1,
  theme,
}: StepHeaderProps) {
  return (
    <>
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
        {title}
      </Text>

      <Text
        modifiers={[
          padding({ top: subtitleTopPadding }),
          font({
            family: FONT_FAMILIES.inter.medium,
            size: subtitleSize,
            weight: SWIFT_FONT_WEIGHTS.medium,
          }),
          foregroundStyle(theme.foreground),
        ]}
      >
        {subtitle}
      </Text>
    </>
  );
}

type ErrorAlertProps = {
  isPresented: boolean;
  message: string;
  onIsPresentedChange: (isPresented: boolean) => void;
  title: string;
};

function ErrorAlert({ isPresented, message, onIsPresentedChange, title }: ErrorAlertProps) {
  return (
    <Alert
      title={title}
      isPresented={isPresented}
      onIsPresentedChange={onIsPresentedChange}
      modifiers={[ZERO_SIZE]}
    >
      <Alert.Trigger>
        <ZStack modifiers={[ZERO_SIZE]}>
          <Text>{""}</Text>
        </ZStack>
      </Alert.Trigger>

      <Alert.Message>
        <Text>{message}</Text>
      </Alert.Message>

      <Alert.Actions>
        <Button label="OK" onPress={() => onIsPresentedChange(false)} />
      </Alert.Actions>
    </Alert>
  );
}

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
  onSubmit: handleSubmit,
  theme,
}: EmailFormStepProps) {
  const validationMessage = errorMessage ?? "Check your email address and try again.";

  return (
    <VStack alignment="leading" modifiers={[FULL_WIDTH]}>
      <VStack alignment="leading" modifiers={getStepModifiers(active)}>
        <StepHeader
          title="Continue with Email"
          subtitle="Sign in or sign up to get started"
          subtitleSize={FONT_SIZES.bodyLarge}
          theme={theme}
        />

        <TextField
          ref={emailFieldRef}
          text={email}
          onTextChange={onEmailChange}
          placeholder="you@example.com"
          modifiers={[
            textFieldStyle("plain"),
            keyboardType("email-address"),
            onSubmit(handleSubmit),
            submitLabel("done"),
            textContentType("emailAddress"),
            textInputAutocapitalization("never"),
            autocorrectionDisabled(),

            font({
              family: FONT_FAMILIES.inter.regular,
              size: FONT_SIZES.input,
            }),
            foregroundStyle(theme.foreground),

            padding({ horizontal: 20 }),
            FULL_WIDTH,
            frame({ height: 52 }),
            background(theme.input),
            clipShape("capsule"),

            accessibilityLabel("Email address"),
            accessibilityHint(invalid ? validationMessage : "Enter your email address."),

            padding({ top: 24 }),
          ]}
        />
      </VStack>

      <ErrorAlert
        title="Invalid email"
        message={validationMessage}
        isPresented={errorAlertPresented}
        onIsPresentedChange={onErrorAlertChange}
      />
    </VStack>
  );
}

type OTPFormStepProps = {
  active: boolean;
  errorAlertPresented: boolean;
  errorMessage?: string | null;
  invalid: boolean;
  onErrorAlertChange: (isPresented: boolean) => void;
  onFocusOTP: () => void;
  onOTPChange: (value: string) => void;
  onSubmit: () => void;
  otp: ObservableStringState;
  otpFieldRef: RefObject<TextFieldRef | null>;
  otpValue: string;
  theme: EmailStepTheme;
};

export function OTPFormStep({
  active,
  errorAlertPresented,
  errorMessage,
  invalid,
  onErrorAlertChange,
  onFocusOTP,
  onOTPChange,
  onSubmit: handleSubmit,
  otp,
  otpFieldRef,
  otpValue,
  theme,
}: OTPFormStepProps) {
  const validationMessage = errorMessage ?? "Enter the 6-digit code and try again.";

  return (
    <VStack alignment="leading" modifiers={[FULL_WIDTH]}>
      <VStack alignment="leading" modifiers={getStepModifiers(active)}>
        <StepHeader
          title="Enter your Passcode"
          subtitle="Check your inbox for a one-time passcode"
          subtitleSize={FONT_SIZES.body}
          subtitleTopPadding={2}
          theme={theme}
        />

        <ZStack modifiers={[FULL_WIDTH, padding({ top: 24 })]}>
          <HStack spacing={10} modifiers={[FULL_WIDTH, onTapGesture(onFocusOTP)]}>
            {OTP_SLOTS.map((slot) => {
              const isCurrentSlot = otpValue.length === slot;

              return (
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
                        : isCurrentSlot
                          ? mobileColors.matcha
                          : "clear",
                      style: { lineWidth: 2 },
                      shape: "roundedRectangle",
                      cornerRadius: 14,
                    }),
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
              );
            })}
          </HStack>

          <TextField
            ref={otpFieldRef}
            text={otp}
            onTextChange={onOTPChange}
            modifiers={[
              textFieldStyle("plain"),
              keyboardType("numeric"),
              onSubmit(handleSubmit),
              submitLabel("done"),
              textContentType("oneTimeCode"),
              textInputAutocapitalization("never"),
              autocorrectionDisabled(),

              accessibilityLabel(
                invalid ? "Invalid 6-digit verification code" : "6-digit verification code",
              ),
              accessibilityHint(
                invalid ? validationMessage : "Enter the verification code we sent.",
              ),

              // Keep the real field full-sized and transparent so iOS can
              // commit an autofilled code to the same native binding.
              foregroundStyle("clear"),
              tint("clear"),
              frame({ maxWidth: Infinity, height: 52 }),
            ]}
          />
        </ZStack>
      </VStack>

      <ErrorAlert
        title="Invalid code"
        message={validationMessage}
        isPresented={errorAlertPresented}
        onIsPresentedChange={onErrorAlertChange}
      />
    </VStack>
  );
}

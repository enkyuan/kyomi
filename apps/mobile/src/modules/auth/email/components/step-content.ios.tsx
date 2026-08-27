import {
  HStack,
  Text,
  TextField,
  type TextFieldRef,
  VStack,
  ZStack,
  type useNativeState,
} from "@expo/ui/swift-ui";
import {
  Animation,
  accessibilityHidden,
  accessibilityHint,
  accessibilityLabel,
  animation,
  autocorrectionDisabled,
  background,
  clipShape,
  disabled,
  font,
  foregroundStyle,
  frame,
  keyboardType,
  onTapGesture,
  opacity,
  offset,
  padding,
  scaleEffect,
  strokeBorder,
  textContentType,
  textFieldStyle,
  textInputAutocapitalization,
} from "@expo/ui/swift-ui/modifiers";
import type { RefObject } from "react";
import { ERROR_SHAKE_STEP_DURATION_SECONDS } from "../hooks/use-error-shake";

const FULL_WIDTH = [frame({ maxWidth: Infinity })];
const OTP_LENGTH = 6;
const ERROR_COLOR = "#c0392b";
const ERROR_SHAKE_ANIMATION = Animation.easeInOut({ duration: ERROR_SHAKE_STEP_DURATION_SECONDS });
const REDUCED_MOTION_ERROR_TRANSITION = Animation.easeOut({ duration: 0.16 });

export type EmailStepTheme = { background: string; foreground: string; input: string };
type ObservableStringState = ReturnType<typeof useNativeState<string>>;

type EmailFormStepProps = {
  active: boolean;
  email: ObservableStringState;
  emailFieldRef: RefObject<TextFieldRef | null>;
  errorMessage?: string | null;
  errorShakeOffset: number;
  invalid: boolean;
  onEmailChange: (value: string) => void;
  reducedMotion: boolean;
  theme: EmailStepTheme;
};

export function EmailFormStep({
  active,
  email,
  emailFieldRef,
  errorMessage,
  errorShakeOffset,
  invalid,
  onEmailChange,
  reducedMotion,
  theme,
}: EmailFormStepProps) {
  return (
    <VStack
      alignment="leading"
      modifiers={[
        ...FULL_WIDTH,
        ...(active ? [] : [frame({ height: 0, alignment: "topLeading" })]),
        opacity(active ? 1 : 0),
        scaleEffect(active || reducedMotion ? 1 : 0.96),
        disabled(!active),
        accessibilityHidden(!active),
      ]}
    >
      <Text
        modifiers={[
          padding({ top: 20 }),
          font({ size: 24, weight: "bold" }),
          foregroundStyle(theme.foreground),
        ]}
      >
        Continue with Email
      </Text>

      <Text
        modifiers={[
          padding({ top: 2 }),
          font({ size: 16, weight: "medium" }),
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
          textContentType("emailAddress"),
          textInputAutocapitalization("never"),
          autocorrectionDisabled(),
          font({ size: 17 }),
          foregroundStyle(theme.foreground),
          padding({ horizontal: 20 }),
          ...FULL_WIDTH,
          frame({ height: 52 }),
          background(theme.input),
          clipShape("capsule"),
          strokeBorder({
            color: invalid ? ERROR_COLOR : "clear",
            style: { lineWidth: 2 },
            shape: "capsule",
          }),
          offset({ x: invalid && !reducedMotion ? errorShakeOffset : 0 }),
          animation(
            reducedMotion ? REDUCED_MOTION_ERROR_TRANSITION : ERROR_SHAKE_ANIMATION,
            errorShakeOffset,
          ),
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
  );
}

type OTPFormStepProps = {
  active: boolean;
  email: ObservableStringState;
  errorMessage?: string | null;
  errorShakeOffset: number;
  invalid: boolean;
  onOtpChange: (value: string) => void;
  otp: ObservableStringState;
  otpFieldRef: RefObject<TextFieldRef | null>;
  otpValue: string;
  reducedMotion: boolean;
  theme: EmailStepTheme;
};

export function OTPFormStep({
  active,
  email,
  errorMessage,
  errorShakeOffset,
  invalid,
  onOtpChange,
  otp,
  otpFieldRef,
  otpValue,
  reducedMotion,
  theme,
}: OTPFormStepProps) {
  return (
    <VStack
      alignment="leading"
      modifiers={[
        ...FULL_WIDTH,
        ...(active ? [] : [frame({ height: 0, alignment: "topLeading" })]),
        opacity(active ? 1 : 0),
        scaleEffect(active || reducedMotion ? 1 : 0.96),
        disabled(!active),
        accessibilityHidden(!active),
      ]}
    >
      <Text
        modifiers={[
          padding({ top: 20 }),
          font({ size: 24, weight: "bold" }),
          foregroundStyle(theme.foreground),
        ]}
      >
        Enter your Passcode
      </Text>

      <Text
        modifiers={[
          padding({ top: 2 }),
          font({ size: 16, weight: "medium" }),
          foregroundStyle(theme.foreground),
        ]}
      >
        {`Check your inbox for a one-time passcode`}
      </Text>

      <ZStack modifiers={[...FULL_WIDTH, padding({ top: 24 })]}>
        <HStack
          spacing={10}
          modifiers={[
            ...FULL_WIDTH,
            offset({ x: invalid && !reducedMotion ? errorShakeOffset : 0 }),
            animation(
              reducedMotion ? REDUCED_MOTION_ERROR_TRANSITION : ERROR_SHAKE_ANIMATION,
              errorShakeOffset,
            ),
          ]}
        >
          {Array.from({ length: OTP_LENGTH }, (_, index) => (
            <ZStack
              // biome-ignore lint: index is stable and positionally meaningful here
              key={index}
              modifiers={[
                frame({ maxWidth: Infinity }),
                frame({ height: 52 }),
                background(theme.input),
                clipShape("roundedRectangle", 14),
                strokeBorder({
                  color: invalid ? ERROR_COLOR : otpValue.length === index ? "#a8d480" : "clear",
                  style: { lineWidth: 2 },
                  shape: "roundedRectangle",
                  cornerRadius: 14,
                }),
                onTapGesture(() => otpFieldRef.current?.focus()),
              ]}
            >
              <Text
                modifiers={[
                  font({ size: 22, weight: "semibold" }),
                  foregroundStyle(theme.foreground),
                ]}
              >
                {otpValue[index] ?? ""}
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
            frame({ width: 0, height: 0 }),
          ]}
        />
      </ZStack>
    </VStack>
  );
}

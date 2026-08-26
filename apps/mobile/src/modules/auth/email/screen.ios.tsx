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
  animation,
  background,
  buttonBorderShape,
  buttonStyle,
  clipShape,
  controlSize,
  font,
  foregroundStyle,
  frame,
  labelStyle,
  padding,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";
import { EmailFormStep, OtpFormStep, type EmailStepTheme } from "./components/step-content.ios";
import { useErrorShake } from "./hooks/use-error-shake";
import { isValidEmail } from "@kyomi/reader/schemas/auth";
import { authClient } from "@/lib/auth";

const FULL_WIDTH = [frame({ maxWidth: Infinity })];
const CENTERED_LABEL = [frame({ maxWidth: Infinity, alignment: "center" })];
const LABEL_FONT = font({ weight: "semibold", size: 18 });
const OTP_LENGTH = 6;
const STEP_TRANSITION = Animation.easeOut({ duration: 0.24 });
const REDUCED_MOTION_STEP_TRANSITION = Animation.easeOut({ duration: 0.16 });

type Theme = EmailStepTheme;

export type EmailSheetProps = {
  isPresented: boolean;
  onDismiss: () => void;
  theme: Theme;
};

type Step = "email" | "otp";

export function EmailSheet({ isPresented, onDismiss, theme }: EmailSheetProps) {
  const shouldReduceMotion = useReducedMotion();
  const email = useNativeState("");
  const otp = useNativeState("");
  const isMountedRef = useRef(true);
  const isPresentedRef = useRef(isPresented);
  const emailFieldRef = useRef<TextFieldRef>(null);
  const otpFieldRef = useRef<TextFieldRef>(null);
  const shouldFocusEmailRef = useRef(false);
  const [otpValue, setOtpValue] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invalidStep, setInvalidStep] = useState<Step | null>(null);
  const {
    cancel: cancelErrorShake,
    offset: errorShakeOffset,
    trigger: triggerErrorShake,
  } = useErrorShake(shouldReduceMotion);

  function reset() {
    if (!isMountedRef.current) return;
    setStep("email");
    setIsSubmitting(false);
    setInvalidStep(null);
    cancelErrorShake();
    setOtpValue("");
  }

  function reportInvalid(step: Step) {
    setInvalidStep(step);
    triggerErrorShake();
  }

  function handleDismiss() {
    if (!isMountedRef.current) return;
    isPresentedRef.current = false;
    reset();
    onDismiss();
  }

  function handleUseDifferentEmail() {
    shouldFocusEmailRef.current = true;
    setStep("email");
    setInvalidStep(null);
    cancelErrorShake();
    setOtpValue("");
    otp.value = "";
  }

  function handleEmailChange() {
    if (invalidStep === "email") {
      setInvalidStep(null);
      cancelErrorShake();
    }
  }

  async function handleSendCode() {
    if (isSubmitting) return;
    if (!isValidEmail(email.value)) {
      reportInvalid("email");
      emailFieldRef.current?.focus();
      return;
    }
    setIsSubmitting(true);
    setInvalidStep(null);
    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
      email: email.value,
      type: "sign-in",
    });
    if (!isMountedRef.current || !isPresentedRef.current) return;
    setIsSubmitting(false);
    if (sendError) {
      reportInvalid("email");
      emailFieldRef.current?.focus();
      return;
    }
    setStep("otp");
  }

  async function handleVerifyCode(code: string) {
    if (isSubmitting) return;
    if (code.length !== OTP_LENGTH) {
      reportInvalid("otp");
      otpFieldRef.current?.focus();
      return;
    }
    setIsSubmitting(true);
    setInvalidStep(null);
    const { error: verifyError } = await authClient.signIn.emailOtp({
      email: email.value,
      otp: code,
    });
    if (!isMountedRef.current || !isPresentedRef.current) return;
    setIsSubmitting(false);
    if (verifyError) {
      reportInvalid("otp");
      otpFieldRef.current?.focus();
      return;
    }
    isPresentedRef.current = false;
    onDismiss();
  }

  function handleOtpChange(typedValue: string) {
    const digitsOnly = typedValue.replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (invalidStep === "otp") {
      setInvalidStep(null);
      cancelErrorShake();
    }
    if (digitsOnly !== typedValue) {
      otp.value = digitsOnly;
    }
    setOtpValue(digitsOnly);
    if (digitsOnly.length === OTP_LENGTH) {
      handleVerifyCode(digitsOnly);
    }
  }

  const isEmailStep = step === "email";
  const isEmailInvalid = invalidStep === "email";
  const isOtpInvalid = invalidStep === "otp";

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    isPresentedRef.current = isPresented;
  }, [isPresented]);

  useEffect(() => {
    if (!isPresented) return;
    email.value = "";
    otp.value = "";
  }, [email, isPresented, otp]);

  useEffect(() => {
    if (!isPresented) return;
    if (!isEmailStep) {
      otpFieldRef.current?.focus();
      return;
    }
    if (shouldFocusEmailRef.current) {
      shouldFocusEmailRef.current = false;
      emailFieldRef.current?.focus();
    }
  }, [isEmailStep, isPresented]);

  return (
    <BottomSheet
      isPresented={isPresented}
      onIsPresentedChange={(open) => !open && handleDismiss()}
      fitToContents
    >
      <VStack modifiers={FULL_WIDTH}>
        <HStack modifiers={[...FULL_WIDTH, padding({ top: 12, trailing: 6 })]}>
          <Spacer />
          <Button
            label="Close"
            systemImage="xmark"
            onPress={handleDismiss}
            modifiers={[
              buttonStyle("bordered"),
              buttonBorderShape("circle"),
              controlSize("large"),
              labelStyle("iconOnly"),
              foregroundStyle(theme.foreground),
              font({ weight: "semibold" }),
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
                font({ size: 24, weight: "semibold" }),
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
                errorShakeOffset={errorShakeOffset}
                invalid={isEmailInvalid}
                onEmailChange={handleEmailChange}
                reducedMotion={shouldReduceMotion}
                theme={theme}
              />
              <OtpFormStep
                active={!isEmailStep}
                email={email}
                errorShakeOffset={errorShakeOffset}
                invalid={isOtpInvalid}
                onOtpChange={handleOtpChange}
                otp={otp}
                otpFieldRef={otpFieldRef}
                otpValue={otpValue}
                reducedMotion={shouldReduceMotion}
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
                    modifiers={[
                      ...CENTERED_LABEL,
                      font({ size: 17, weight: "medium" }),
                      foregroundStyle(theme.foreground),
                    ]}
                  >
                    Use a different email
                  </Text>
                </ZStack>
              </Button>
            ) : null}
          </VStack>

          <Button
            onPress={isEmailStep ? handleSendCode : () => handleVerifyCode(otpValue)}
            modifiers={[
              buttonStyle("glassProminent"),
              buttonBorderShape("capsule"),
              tint("#a8d480"),
              padding({ top: 24 }),
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
                  Continue
                </Text>
              )}
            </ZStack>
          </Button>
        </VStack>
      </VStack>
    </BottomSheet>
  );
}

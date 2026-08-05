import CloseSymbol from "@expo/material-symbols/close.xml";
import MailSymbol from "@expo/material-symbols/mail.xml";
import { BottomSheet } from "@expo/ui";
import {
  AnimatedVisibility,
  BasicTextField,
  Box,
  Button,
  CircularProgressIndicator,
  Column,
  EnterTransition,
  ExitTransition,
  Icon,
  IconButton,
  OutlinedTextField,
  Row,
  Shape,
  Text,
  type TextFieldRef,
  useNativeState,
} from "@expo/ui/jetpack-compose";
import {
  align,
  background,
  border,
  clickable,
  clip,
  fillMaxWidth,
  graphicsLayer,
  height,
  animated,
  padding,
  paddingAll,
  semantics,
  Shapes,
  size,
  tween,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";
import { ERROR_SHAKE_STEP_DURATION_MS, useErrorShake } from "./hooks/use-error-shake";
import { authClient } from "@/lib/auth-client";

const BUTTON_LABEL_STYLE = { fontSize: 18, fontWeight: "600" as const };
const OTP_LENGTH = 6;
const ERROR_COLOR = "#c0392b";
const STEP_ENTER_TRANSITION = EnterTransition.fadeIn()
  .plus(EnterTransition.scaleIn({ initialScale: 0.96 }))
  .plus(EnterTransition.expandVertically());
const STEP_EXIT_TRANSITION = ExitTransition.fadeOut()
  .plus(ExitTransition.scaleOut({ targetScale: 0.96 }))
  .plus(ExitTransition.shrinkVertically());
const REDUCED_MOTION_STEP_ENTER_TRANSITION = EnterTransition.fadeIn();
const REDUCED_MOTION_STEP_EXIT_TRANSITION = ExitTransition.fadeOut();

type Theme = { background: string; foreground: string; input: string };

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
  const emailFieldRef = useRef<TextFieldRef>(null);
  const otpFieldRef = useRef<TextFieldRef>(null);
  const isMountedRef = useRef(true);
  const isPresentedRef = useRef(isPresented);
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
  const errorShake = animated(
    shouldReduceMotion ? 0 : errorShakeOffset,
    tween({ durationMillis: ERROR_SHAKE_STEP_DURATION_MS, easing: "ease" }),
  );
  const stepEnterTransition = shouldReduceMotion
    ? REDUCED_MOTION_STEP_ENTER_TRANSITION
    : STEP_ENTER_TRANSITION;
  const stepExitTransition = shouldReduceMotion
    ? REDUCED_MOTION_STEP_EXIT_TRANSITION
    : STEP_EXIT_TRANSITION;

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
    <BottomSheet isPresented={isPresented} onDismiss={handleDismiss}>
      <Column modifiers={[fillMaxWidth()]}>
        <Box modifiers={[fillMaxWidth(), paddingAll(16)]} contentAlignment="topEnd">
          <IconButton onClick={handleDismiss}>
            <Icon
              contentDescription="Close"
              source={CloseSymbol}
              size={28}
              tint={theme.foreground}
            />
          </IconButton>
        </Box>

        <Column horizontalAlignment="start" modifiers={[fillMaxWidth(), padding(24, 0, 24, 24)]}>
          <Box
            contentAlignment="center"
            modifiers={[size(64, 64), background(theme.input), clip(Shapes.Circle)]}
          >
            <Icon source={MailSymbol} size={24} tint={theme.foreground} />
          </Box>

          <Box modifiers={[fillMaxWidth()]}>
            <AnimatedVisibility
              visible={isEmailStep}
              enterTransition={stepEnterTransition}
              exitTransition={stepExitTransition}
            >
              <Column horizontalAlignment="start" modifiers={[fillMaxWidth()]}>
                <Text
                  color={theme.foreground}
                  modifiers={[padding(0, 20, 0, 0)]}
                  style={{ fontSize: 24, fontWeight: "600" }}
                >
                  Continue with Email
                </Text>

                <Text
                  color={theme.foreground}
                  modifiers={[padding(0, 6, 0, 0)]}
                  style={{ fontSize: 15 }}
                >
                  Sign in or sign up with your email.
                </Text>

                <OutlinedTextField
                  ref={emailFieldRef}
                  value={email}
                  isError={isEmailInvalid}
                  onValueChange={handleEmailChange}
                  modifiers={[
                    fillMaxWidth(),
                    padding(0, 24, 0, 0),
                    height(52),
                    graphicsLayer({ translationX: isEmailInvalid ? errorShake : 0 }),
                  ]}
                  keyboardOptions={{
                    keyboardType: "email",
                    capitalization: "none",
                    autoCorrectEnabled: false,
                  }}
                >
                  <OutlinedTextField.Placeholder>
                    <Text>you@example.com</Text>
                  </OutlinedTextField.Placeholder>
                </OutlinedTextField>
              </Column>
            </AnimatedVisibility>

            <AnimatedVisibility
              visible={!isEmailStep}
              enterTransition={stepEnterTransition}
              exitTransition={stepExitTransition}
            >
              <Column horizontalAlignment="start" modifiers={[fillMaxWidth()]}>
                <Text
                  color={theme.foreground}
                  modifiers={[padding(0, 20, 0, 0)]}
                  style={{ fontSize: 24, fontWeight: "600" }}
                >
                  Enter your code
                </Text>

                <Text
                  color={theme.foreground}
                  modifiers={[padding(0, 6, 0, 0)]}
                  style={{ fontSize: 15 }}
                >
                  {`We sent a code to ${email.value}.`}
                </Text>

                <Box
                  modifiers={[
                    fillMaxWidth(),
                    padding(0, 24, 0, 0),
                    graphicsLayer({ translationX: isOtpInvalid ? errorShake : 0 }),
                  ]}
                >
                  <Row horizontalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth()]}>
                    {Array.from({ length: OTP_LENGTH }, (_, index) => (
                      <Box
                        // biome-ignore lint: index is stable and positionally meaningful here
                        key={index}
                        contentAlignment="center"
                        modifiers={[
                          weight(1),
                          height(52),
                          background(theme.input),
                          clip(Shapes.RoundedCorner(14)),
                          border(
                            2,
                            isOtpInvalid
                              ? ERROR_COLOR
                              : otpValue.length === index
                                ? "#a8d480"
                                : "transparent",
                          ),
                          clickable(() => otpFieldRef.current?.focus()),
                        ]}
                      >
                        <Text style={{ fontSize: 22, fontWeight: "600" }} color={theme.foreground}>
                          {otpValue[index] ?? ""}
                        </Text>
                      </Box>
                    ))}
                  </Row>
                  <BasicTextField
                    ref={otpFieldRef}
                    value={otp}
                    onValueChange={handleOtpChange}
                    keyboardOptions={{
                      keyboardType: "number",
                      capitalization: "none",
                      autoCorrectEnabled: false,
                    }}
                    modifiers={[size(0, 0), semantics({ contentType: "one-time-code" })]}
                  />
                </Box>

                <Button
                  onClick={handleUseDifferentEmail}
                  colors={{ containerColor: "transparent", contentColor: theme.foreground }}
                  contentPadding={{ top: 12, bottom: 12 }}
                  modifiers={[fillMaxWidth(), padding(0, 12, 0, 0)]}
                >
                  <Box modifiers={[fillMaxWidth()]}>
                    <Text style={{ fontSize: 15, fontWeight: "500" }} modifiers={[align("center")]}>
                      Use a different email
                    </Text>
                  </Box>
                </Button>
              </Column>
            </AnimatedVisibility>
          </Box>

          <Button
            onClick={isEmailStep ? handleSendCode : () => handleVerifyCode(otpValue)}
            shape={Shape.Pill({})}
            colors={{ containerColor: "#a8d480", contentColor: theme.background }}
            contentPadding={{ top: 14, bottom: 14 }}
            modifiers={[fillMaxWidth(), padding(0, 24, 0, 0)]}
          >
            <Box modifiers={[fillMaxWidth(), height(22)]} contentAlignment="center">
              {isSubmitting ? (
                <CircularProgressIndicator
                  color={theme.background}
                  strokeWidth={2}
                  modifiers={[size(20, 20)]}
                />
              ) : (
                <Text style={BUTTON_LABEL_STYLE} modifiers={[align("center")]}>
                  Continue
                </Text>
              )}
            </Box>
          </Button>
        </Column>
      </Column>
    </BottomSheet>
  );
}

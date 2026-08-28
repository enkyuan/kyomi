import { BottomSheet, Button, Text, TextInput, useNativeState } from "@expo/ui";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ERROR_SHAKE_STEP_DURATION_MS, useErrorShake } from "./hooks/use-error-shake";
import { CloseIcon } from "@/components/icons";
import { FONT_STYLES } from "@/theme/fonts";
import { isValidEmail } from "@kyomi/reader/schemas/auth";
import { authClient } from "@/lib/auth";

type Theme = { background: string; foreground: string; input: string };

export type EmailSheetProps = {
  isPresented: boolean;
  onDismiss: () => void;
  theme: Theme;
};

type Step = "email" | "otp";

const ERROR_COLOR = "#c0392b";

export function EmailSheet({ isPresented, onDismiss, theme }: EmailSheetProps) {
  const email = useNativeState("");
  const otp = useNativeState("");
  const [step, setStep] = useState<Step>("email");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invalidStep, setInvalidStep] = useState<Step | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const {
    cancel: cancelErrorShake,
    offset: errorShakeOffset,
    trigger: triggerErrorShake,
  } = useErrorShake(shouldReduceMotion);
  const errorShake = useSharedValue(0);
  const errorShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: errorShake.value }],
  }));

  useEffect(() => {
    errorShake.value = withTiming(errorShakeOffset, {
      duration: ERROR_SHAKE_STEP_DURATION_MS,
      easing: Easing.inOut(Easing.ease),
    });
  }, [errorShake, errorShakeOffset]);

  function reset() {
    setStep("email");
    setIsSubmitting(false);
    setInvalidStep(null);
    setErrorMessage(null);
    cancelErrorShake();
    email.value = "";
    otp.value = "";
  }

  function reportInvalid(nextInvalidStep: Step, message?: string | null) {
    setInvalidStep(nextInvalidStep);
    setErrorMessage(
      message ??
        (nextInvalidStep === "email"
          ? "Enter a valid email address."
          : "Invalid verification code."),
    );
    triggerErrorShake();
  }

  function handleDismiss() {
    reset();
    onDismiss();
  }

  async function handleSendCode() {
    if (isSubmitting) return;
    const normalizedEmail = email.value.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      reportInvalid("email", "Enter a valid email address.");
      return;
    }
    setIsSubmitting(true);
    setInvalidStep(null);
    setErrorMessage(null);
    try {
      const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: "sign-in",
      });
      setIsSubmitting(false);
      if (sendError) {
        const errorMsg = sendError.message?.trim() || "Could not send sign-in code.";
        reportInvalid("email", errorMsg);
        return;
      }
      setStep("otp");
    } catch {
      setIsSubmitting(false);
      reportInvalid("email", "Unable to connect to server. Check your connection.");
    }
  }

  async function handleVerifyCode() {
    if (isSubmitting) return;

    if (otp.value.length !== 6) {
      reportInvalid("otp", "Code must be 6 digits.");
      return;
    }

    const normalizedEmail = email.value.trim().toLowerCase();
    setIsSubmitting(true);
    setInvalidStep(null);
    setErrorMessage(null);
    try {
      const { error: verifyError } = await authClient.signIn.emailOtp({
        email: normalizedEmail,
        otp: otp.value,
      });
      setIsSubmitting(false);
      if (verifyError) {
        const errorMsg = verifyError.message?.trim() || "Invalid verification code.";
        reportInvalid("otp", errorMsg);
        return;
      }
      reset();
      onDismiss();
    } catch {
      setIsSubmitting(false);
      reportInvalid("otp", "Unable to connect to server. Check your connection.");
    }
  }

  const isEmailStep = step === "email";
  const isEmailInvalid = invalidStep === "email";
  const isOtpInvalid = invalidStep === "otp";

  function handleEmailChange() {
    if (isEmailInvalid || errorMessage) {
      setInvalidStep(null);
      setErrorMessage(null);
      cancelErrorShake();
    }
  }

  function handleOtpChange() {
    if (isOtpInvalid || errorMessage) {
      setInvalidStep(null);
      setErrorMessage(null);
      cancelErrorShake();
    }
  }

  return (
    <BottomSheet isPresented={isPresented} onDismiss={handleDismiss}>
      <View style={{ width: "100%", padding: 16, alignItems: "flex-end" }}>
        <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={handleDismiss}>
          <CloseIcon fill={theme.foreground} size={22} />
        </Pressable>
      </View>

      <View style={{ width: "100%", paddingHorizontal: 24, paddingBottom: 24 }}>
        <Text textStyle={{ ...FONT_STYLES.screenTitle, color: theme.foreground }}>
          {isEmailStep ? "Continue with Email" : "Enter your code"}
        </Text>

        <View style={{ marginTop: 6 }}>
          <Text textStyle={{ ...FONT_STYLES.bodyMedium, color: theme.foreground }}>
            {isEmailStep
              ? "Sign in or sign up with your email."
              : `We sent a code to ${email.value}.`}
          </Text>
        </View>

        <View style={{ marginTop: 24 }}>
          {isEmailStep ? (
            <Animated.View style={errorShakeStyle}>
              <TextInput
                value={email}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={handleEmailChange}
                style={{
                  ...FONT_STYLES.input,
                  width: "100%",
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  backgroundColor: theme.input,
                  borderWidth: 2,
                  borderColor: isEmailInvalid ? ERROR_COLOR : "transparent",
                  borderRadius: 999,
                }}
              />
            </Animated.View>
          ) : (
            <Animated.View style={errorShakeStyle}>
              <TextInput
                value={otp}
                placeholder="123456"
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={handleOtpChange}
                style={{
                  ...FONT_STYLES.input,
                  width: "100%",
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  backgroundColor: theme.input,
                  borderWidth: 2,
                  borderColor: isOtpInvalid ? ERROR_COLOR : "transparent",
                  borderRadius: 999,
                }}
              />
            </Animated.View>
          )}
        </View>

        <View style={{ marginTop: 24 }}>
          <Button
            variant="outlined"
            style={{ width: "100%", backgroundColor: "#a8d480" }}
            onPress={isEmailStep ? handleSendCode : handleVerifyCode}
          >
            <Text
              textStyle={{ ...FONT_STYLES.button, textAlign: "center", color: theme.background }}
            >
              {isSubmitting ? "Please wait…" : "Continue"}
            </Text>
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
}

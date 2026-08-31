import { BottomSheet, Button, Text, TextInput, useNativeState } from "@expo/ui";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { CloseIcon } from "@/components/icons";
import { mobileColors } from "@/theme/colors";
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

export function EmailSheet({ isPresented, onDismiss, theme }: EmailSheetProps) {
  const email = useNativeState("");
  const otp = useNativeState("");
  const [step, setStep] = useState<Step>("email");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invalidStep, setInvalidStep] = useState<Step | null>(null);
  function reset() {
    setStep("email");
    setIsSubmitting(false);
    setInvalidStep(null);
    email.value = "";
    otp.value = "";
  }

  function reportInvalid(nextInvalidStep: Step) {
    setInvalidStep(nextInvalidStep);
  }

  function handleDismiss() {
    reset();
    onDismiss();
  }

  async function handleSendCode() {
    if (isSubmitting) return;
    const normalizedEmail = email.value.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      reportInvalid("email");
      return;
    }
    setIsSubmitting(true);
    setInvalidStep(null);
    try {
      const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: "sign-in",
      });
      setIsSubmitting(false);
      if (sendError) {
        reportInvalid("email");
        return;
      }
      setStep("otp");
    } catch {
      setIsSubmitting(false);
      reportInvalid("email");
    }
  }

  async function handleVerifyCode() {
    if (isSubmitting) return;

    if (otp.value.length !== 6) {
      reportInvalid("otp");
      return;
    }

    const normalizedEmail = email.value.trim().toLowerCase();
    setIsSubmitting(true);
    setInvalidStep(null);
    try {
      const { error: verifyError } = await authClient.signIn.emailOtp({
        email: normalizedEmail,
        otp: otp.value,
      });
      setIsSubmitting(false);
      if (verifyError) {
        reportInvalid("otp");
        return;
      }
      reset();
      onDismiss();
    } catch {
      setIsSubmitting(false);
      reportInvalid("otp");
    }
  }

  const isEmailStep = step === "email";
  const isEmailInvalid = invalidStep === "email";
  const isOtpInvalid = invalidStep === "otp";

  function handleEmailChange() {
    if (isEmailInvalid) {
      setInvalidStep(null);
    }
  }

  function handleOtpChange() {
    if (isOtpInvalid) {
      setInvalidStep(null);
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
            <TextInput
              value={email}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={handleEmailChange}
              onSubmitEditing={handleSendCode}
              returnKeyType="done"
              style={{
                ...FONT_STYLES.input,
                width: "100%",
                paddingVertical: 14,
                paddingHorizontal: 20,
                backgroundColor: theme.input,
                borderWidth: 2,
                borderColor: isEmailInvalid ? mobileColors.validationError : "transparent",
                borderRadius: 999,
              }}
            />
          ) : (
            <TextInput
              value={otp}
              placeholder="123456"
              keyboardType="number-pad"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={6}
              onChangeText={handleOtpChange}
              onSubmitEditing={() =>
                otp.value.length === 6 ? handleVerifyCode() : handleSendCode()
              }
              returnKeyType="done"
              style={{
                ...FONT_STYLES.input,
                width: "100%",
                paddingVertical: 14,
                paddingHorizontal: 20,
                backgroundColor: theme.input,
                borderWidth: 2,
                borderColor: isOtpInvalid ? mobileColors.validationError : "transparent",
                borderRadius: 999,
              }}
            />
          )}
        </View>

        <View style={{ marginTop: 24 }}>
          <Button
            variant="outlined"
            style={{ width: "100%", backgroundColor: mobileColors.matcha }}
            onPress={isEmailStep || otp.value.length !== 6 ? handleSendCode : handleVerifyCode}
          >
            <Text
              textStyle={{ ...FONT_STYLES.button, textAlign: "center", color: theme.background }}
            >
              {isSubmitting
                ? "Please wait…"
                : isEmailStep || otp.value.length === 6
                  ? "Continue"
                  : "Resend email"}
            </Text>
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
}

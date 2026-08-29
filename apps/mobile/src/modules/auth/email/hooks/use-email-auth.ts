import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";
import { useErrorShake } from "./use-error-shake";
import { isValidEmail } from "@kyomi/reader/schemas/auth";
import { authClient } from "@/lib/auth";

export const OTP_LENGTH = 6;

type NativeStringState = {
  value: string;
};

type UseEmailAuthOptions = {
  readonly email: NativeStringState;
  readonly focusEmail?: () => void;
  readonly focusOtp?: () => void;
  readonly isPresented: boolean;
  readonly onDismiss: () => void;
  readonly otp: NativeStringState;
};

export function useEmailAuth({
  email,
  focusEmail,
  focusOtp,
  isPresented,
  onDismiss,
  otp,
}: UseEmailAuthOptions) {
  const shouldReduceMotion = useReducedMotion();
  const isMountedRef = useRef(true);
  const isPresentedRef = useRef(isPresented);
  const shouldFocusEmailRef = useRef(false);
  const [otpValue, setOtpValue] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invalidStep, setInvalidStep] = useState<"email" | "otp" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showEmailInvalidAlert, setShowEmailInvalidAlert] = useState(false);
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
    setErrorMessage(null);
    setShowEmailInvalidAlert(false);
    cancelErrorShake();
    setOtpValue("");
  }

  function reportInvalid(
    nextInvalidStep: "email" | "otp",
    message?: string | null,
    showEmailAlert = false,
  ) {
    setInvalidStep(nextInvalidStep);
    setShowEmailInvalidAlert(showEmailAlert);
    setErrorMessage(
      message ??
        (nextInvalidStep === "email"
          ? "Enter a valid email address."
          : "Invalid verification code."),
    );
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
    setErrorMessage(null);
    setShowEmailInvalidAlert(false);
    cancelErrorShake();
    setOtpValue("");
    otp.value = "";
  }

  function handleEmailChange() {
    if (invalidStep === "email" || errorMessage) {
      setInvalidStep(null);
      setErrorMessage(null);
      setShowEmailInvalidAlert(false);
      cancelErrorShake();
    }
  }

  function handleEmailInvalidAlertChange(isPresented: boolean) {
    if (!isPresented) setShowEmailInvalidAlert(false);
  }

  async function handleSendCode() {
    if (isSubmitting) return;
    const normalizedEmail = email.value.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      reportInvalid("email", "Enter a valid email address.", true);
      focusEmail?.();
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
      if (!isMountedRef.current || !isPresentedRef.current) return;
      setIsSubmitting(false);
      if (sendError) {
        reportInvalid("email", sendError.message?.trim() || "Could not send sign-in code.");
        focusEmail?.();
        return;
      }
      setStep("otp");
    } catch {
      if (!isMountedRef.current || !isPresentedRef.current) return;
      setIsSubmitting(false);
      reportInvalid("email", "Unable to connect to server. Check your connection.");
      focusEmail?.();
    }
  }

  async function handleVerifyCode(code: string) {
    if (isSubmitting) return;
    if (code.length !== OTP_LENGTH) {
      reportInvalid("otp", "Code must be 6 digits.");
      focusOtp?.();
      return;
    }
    const normalizedEmail = email.value.trim().toLowerCase();
    setIsSubmitting(true);
    setInvalidStep(null);
    setErrorMessage(null);
    try {
      const { error: verifyError } = await authClient.signIn.emailOtp({
        email: normalizedEmail,
        otp: code,
      });
      if (!isMountedRef.current || !isPresentedRef.current) return;
      setIsSubmitting(false);
      if (verifyError) {
        reportInvalid("otp", verifyError.message?.trim() || "Invalid verification code.");
        focusOtp?.();
        return;
      }
      isPresentedRef.current = false;
      onDismiss();
    } catch {
      if (!isMountedRef.current || !isPresentedRef.current) return;
      setIsSubmitting(false);
      reportInvalid("otp", "Unable to connect to server. Check your connection.");
      focusOtp?.();
    }
  }

  function handleOtpChange(typedValue: string) {
    const digitsOnly = typedValue.replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (invalidStep === "otp" || errorMessage) {
      setInvalidStep(null);
      setErrorMessage(null);
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
    if (step === "otp") {
      focusOtp?.();
      return;
    }
    if (shouldFocusEmailRef.current) {
      shouldFocusEmailRef.current = false;
      focusEmail?.();
    }
  }, [focusEmail, focusOtp, isPresented, step]);

  return {
    cancelErrorShake,
    errorMessage,
    errorShakeOffset,
    handleDismiss,
    handleEmailChange,
    handleEmailInvalidAlertChange,
    handleOtpChange,
    handleSendCode,
    handleUseDifferentEmail,
    handleVerifyCode,
    invalidStep,
    isEmailInvalid: invalidStep === "email",
    isEmailStep: step === "email",
    showEmailInvalidAlert,
    isOtpInvalid: invalidStep === "otp",
    isSubmitting,
    otpValue,
    shouldReduceMotion,
    triggerErrorShake,
  };
}

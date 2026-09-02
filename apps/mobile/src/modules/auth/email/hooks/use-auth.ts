import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { runOnJS } from "react-native-worklets";
import { isValidEmail } from "@kyomi/reader/schemas/auth";
import { authClient } from "@/lib/auth";
import { OTP_LENGTH } from "../constants";

export { OTP_LENGTH } from "../constants";

type NativeStringState = {
  set: (value: string) => void;
  value: string;
  onChange: ((value: string) => void) | null;
};

type UseEmailAuthOptions = {
  readonly email: NativeStringState;
  readonly focusEmail?: () => void;
  readonly focusOTP?: () => void;
  readonly isPresented: boolean;
  readonly onDismiss: () => void;
  readonly otp: NativeStringState;
};

export function useEmailAuth({
  email,
  focusEmail,
  focusOTP,
  isPresented,
  onDismiss,
  otp,
}: UseEmailAuthOptions) {
  const shouldReduceMotion = useReducedMotion();
  // Async results must not update a dismissed sheet.
  const isMountedRef = useRef(true);
  const isPresentedRef = useRef(isPresented);
  const shouldFocusEmailRef = useRef(false);
  const [otpValue, setOTPValue] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invalidStep, setInvalidStep] = useState<"email" | "otp" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showErrorAlert, setShowErrorAlert] = useState(false);

  function reset() {
    if (!isMountedRef.current) return;
    setStep("email");
    setIsSubmitting(false);
    setInvalidStep(null);
    setErrorMessage(null);
    setShowErrorAlert(false);
    setOTPValue("");
  }

  function reportInvalid(nextInvalidStep: "email" | "otp", message?: string | null) {
    setInvalidStep(nextInvalidStep);
    setShowErrorAlert(true);
    setErrorMessage(
      message ??
        (nextInvalidStep === "email"
          ? "Enter a valid email address."
          : "Invalid verification code."),
    );
  }

  function clearError() {
    setInvalidStep(null);
    setErrorMessage(null);
    setShowErrorAlert(false);
  }

  function handleDismiss() {
    if (!isMountedRef.current) return;
    isPresentedRef.current = false;
    Keyboard.dismiss();
    reset();
    onDismiss();
  }

  function handleUseDifferentEmail() {
    shouldFocusEmailRef.current = true;
    setStep("email");
    clearError();
    setOTPValue("");
    otp.set("");
  }

  function handleEmailChange() {
    if (invalidStep === "email" || errorMessage) clearError();
  }

  // React-side handler that clears stale errors and syncs the visual OTP
  // slots with the latest digit string.  Invokable from a UI worklet via runOnJS.
  const handleOTPChangeReactSide = useCallback(
    (digitsOnly: string) => {
      if (invalidStep === "otp" || errorMessage) clearError();
      setOTPValue(digitsOnly);
    },
    [invalidStep, errorMessage, clearError, setOTPValue],
  );

  // Worklet callback for TextField.onTextChange / BasicTextField.onValueChange.
  // Running on the UI thread lets us call otp.set() synchronously, which is
  // critical for iOS OTP autofill: the oneTimeCode suggestion inserts the full
  // code string in one shot, and any async gap can let the native binding
  // revert to a stale value before the JS event loop picks up the change.
  const handleOTPChange = useCallback(
    (typedValue: string) => {
      "worklet";
      let digitsOnly: string;
      if (typeof typedValue === "string") {
        digitsOnly = typedValue.replace(/\D/g, "").slice(0, OTP_LENGTH);
      } else {
        digitsOnly = "";
      }
      otp.set(digitsOnly);
      runOnJS(handleOTPChangeReactSide)(digitsOnly);
    },
    [otp, handleOTPChangeReactSide],
  );

  // Safety net: sync React state whenever the native ObservableState changes,
  // regardless of how it was triggered (user typing, OTP autofill insertion,
  // or programmatic set from another code path).  The worklet listener fires
  // synchronously on the UI thread and schedules the React state update on
  // JS — ensuring the visual slots always reflect the true native value.
  useEffect(() => {
    otp.onChange = (value: string) => {
      "worklet";
      runOnJS(setOTPValue)(value ?? "");
    };
    return () => {
      otp.onChange = null;
    };
  }, [otp]);

  function handleErrorAlertChange(isPresented: boolean) {
    if (!isPresented) setShowErrorAlert(false);
  }

  function handleSendCode() {
    if (isSubmitting) return;
    const normalizedEmail = email.value.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      reportInvalid("email", "Enter a valid email address.");
      focusEmail?.();
      return;
    }
    setIsSubmitting(true);
    clearError();
    void authClient.emailOtp
      .sendVerificationOtp({
        email: normalizedEmail,
        type: "sign-in",
      })
      .then(
        ({ error: sendError }: { error?: { message?: string } | null }) => {
          if (!isMountedRef.current || !isPresentedRef.current) return;
          setIsSubmitting(false);
          if (sendError) {
            reportInvalid("email", sendError.message?.trim() || "Could not send sign-in code.");
            focusEmail?.();
            return;
          }
          setStep("otp");
        },
        () => {
          if (!isMountedRef.current || !isPresentedRef.current) return;
          setIsSubmitting(false);
          reportInvalid("email", "Unable to connect to server. Check your connection.");
          focusEmail?.();
        },
      );
  }

  function handleVerifyCode(code: string) {
    if (isSubmitting) return;
    if (code.length !== OTP_LENGTH) {
      reportInvalid("otp", "Code must be 6 digits.");
      focusOTP?.();
      return;
    }
    const normalizedEmail = email.value.trim().toLowerCase();
    setIsSubmitting(true);
    clearError();
    void authClient.signIn
      .emailOtp({
        email: normalizedEmail,
        otp: code,
      })
      .then(
        ({ error: verifyError }: { error?: { message?: string } | null }) => {
          if (!isMountedRef.current || !isPresentedRef.current) return;
          setIsSubmitting(false);
          if (verifyError) {
            reportInvalid("otp", verifyError.message?.trim() || "Invalid verification code.");
            focusOTP?.();
            return;
          }
          isPresentedRef.current = false;
          Keyboard.dismiss();
          onDismiss();
        },
        () => {
          if (!isMountedRef.current || !isPresentedRef.current) return;
          setIsSubmitting(false);
          reportInvalid("otp", "Unable to connect to server. Check your connection.");
          focusOTP?.();
        },
      );
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
    if (step === "otp") {
      focusOTP?.();
      return;
    }
    if (shouldFocusEmailRef.current) {
      shouldFocusEmailRef.current = false;
      focusEmail?.();
    }
  }, [focusEmail, focusOTP, isPresented, step]);

  return {
    errorMessage,
    handleDismiss,
    handleEmailChange,
    handleErrorAlertChange,
    handleOTPChange,
    handleSendCode,
    handleUseDifferentEmail,
    handleVerifyCode,
    isEmailInvalid: invalidStep === "email",
    isEmailStep: step === "email",
    showErrorAlert,
    isOTPInvalid: invalidStep === "otp",
    isSubmitting,
    otpValue,
    shouldReduceMotion,
  };
}

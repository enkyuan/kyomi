"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { authClient } from "@lib/auth/client";
import { getUserSafeErrorMessage, logClientError } from "@kyomi/reader/lib/errors";
import { isValidEmail, otpFormValidator } from "@modules/auth/schema";
import { toastManager } from "@kyomi/ui/components/toast";
import { authSessionsQueryKey } from "../lib/session/api";

/**
 * The three prompts of Better Auth's email-OTP change-email flow with `verifyCurrentEmail`:
 * the new address, the code mailed to the current address, then the code mailed to the new one.
 */
export type EmailChangeStep = "address" | "current" | "new";

type AuthFailure = { code?: string; message?: string; status: number };

export const EMAIL_CODE_LENGTH = 6;

const CODE_REQUIRED_MESSAGE = `Enter the ${EMAIL_CODE_LENGTH}-digit code sent to your email.`;

function describeFailure(failure: AuthFailure, step: EmailChangeStep, fallback: string) {
  const startAgain = step === "new" ? "Go back and start again." : "Send a new code.";

  switch (failure.code) {
    case "INVALID_OTP":
      return "That code is incorrect. Check it and try again.";
    case "OTP_EXPIRED":
      return `That code has expired. ${startAgain}`;
    case "TOO_MANY_ATTEMPTS":
      return `Too many incorrect attempts. ${startAgain}`;
    default:
      break;
  }

  if (failure.status === 429) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (failure.status === 401) {
    return "Your session has expired. Sign in again.";
  }

  return getUserSafeErrorMessage(new Error(failure.message?.trim() || fallback), fallback);
}

export function useEmailChange({
  currentEmail,
  onDone,
}: {
  currentEmail: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [step, setStep] = useState<EmailChangeStep>("address");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const inFlight = useRef(false);

  const newEmail = draft.trim();

  /**
   * Runs one request at a time. The action resolves to the inline error to show, or null; so does
   * this, so a step can tell whether its submit was rejected.
   */
  const attempt = async (action: () => Promise<string | null>): Promise<string | null> => {
    if (inFlight.current) {
      return null;
    }
    inFlight.current = true;
    setIsPending(true);
    setError(null);
    try {
      const failure = await action();
      setError(failure);
      return failure;
    } catch (caught) {
      logClientError("settings.account.email", caught);
      const failure = "Something went wrong. Try again.";
      setError(failure);
      return failure;
    } finally {
      inFlight.current = false;
      setIsPending(false);
    }
  };

  const sendCurrentEmailCode = async () => {
    const result = await authClient.emailOtp.sendVerificationOtp({
      email: currentEmail,
      type: "email-verification",
    });
    return result.error
      ? describeFailure(result.error, "address", "Could not send the code. Try again.")
      : null;
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    setError(null);
  };

  const clearError = () => {
    setError(null);
  };

  const goBack = () => {
    setStep("address");
    setError(null);
  };

  const submitAddress = () =>
    attempt(async () => {
      if (!isValidEmail(newEmail)) {
        return "Enter a valid email address.";
      }
      if (newEmail.toLowerCase() === currentEmail.trim().toLowerCase()) {
        return "Enter a different email address.";
      }

      const failure = await sendCurrentEmailCode();
      if (!failure) {
        setStep("current");
      }
      return failure;
    });

  const resendCurrentCode = () =>
    attempt(async () => {
      const failure = await sendCurrentEmailCode();
      if (!failure) {
        toastManager.add({
          title: "Code sent",
          type: "success",
        });
      }
      return failure;
    });

  /** The server answers the same whether or not the new address is registered. */
  const submitCurrentCode = (code: string) =>
    attempt(async () => {
      const invalid = otpFormValidator({ value: { otp: code } });
      if (invalid) {
        return CODE_REQUIRED_MESSAGE;
      }

      const result = await authClient.emailOtp.requestEmailChange({ newEmail, otp: code });
      if (result.error) {
        if (result.error.code === "INVALID_EMAIL") {
          setStep("address");
          return "Enter a valid email address.";
        }
        return describeFailure(result.error, "current", "Could not verify the code. Try again.");
      }

      setStep("new");
      return null;
    });

  const submitNewCode = (code: string) =>
    attempt(async () => {
      const invalid = otpFormValidator({ value: { otp: code } });
      if (invalid) {
        return CODE_REQUIRED_MESSAGE;
      }

      const result = await authClient.emailOtp.changeEmail({ newEmail, otp: code });
      if (result.error) {
        return describeFailure(result.error, "new", "Could not change your email. Try again.");
      }

      onDone();
      toastManager.add({ title: "Email updated", type: "success" });
      // The email-OTP client plugin only signals the session store for the request step, so the
      // live session would keep showing the old address until its next poll.
      authClient.$store.notify("$sessionSignal");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: authSessionsQueryKey() }),
        router.invalidate(),
      ]).catch((caught: unknown) => {
        logClientError("settings.account.email_refresh", caught);
      });
      return null;
    });

  return {
    clearError,
    draft,
    error,
    goBack,
    handleDraftChange,
    isPending,
    newEmail,
    resendCurrentCode,
    step,
    submitAddress,
    submitCurrentCode,
    submitNewCode,
  };
}

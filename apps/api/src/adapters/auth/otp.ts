import { Effect } from "effect";
import type { HttpClient } from "effect/http";
import { AppLogger } from "@adapters/logger/service";
import type { AppConfig } from "@config/env/service";
import { serializeError } from "@shared/errors/serialize";
import { deliverEmail } from "./resend";

export type EmailOTPMessage = {
  to: string;
  otp: string;
  /** What the code is for; a code that confirms a new address is worded differently. */
  purpose?: "sign-in" | "change-email" | "verify-current-email";
};

const WORDING = {
  "sign-in": { subject: "Your Kyomi sign-in code", noun: "sign-in code" },
  "change-email": { subject: "Confirm your new Kyomi email", noun: "confirmation code" },
  "verify-current-email": {
    subject: "Confirm your Kyomi email change",
    noun: "confirmation code",
  },
} as const;

export function createEmailOTPBody({ otp, purpose = "sign-in" }: EmailOTPMessage) {
  const { subject, noun } = WORDING[purpose];
  return {
    subject,
    text: `Your Kyomi ${noun} is ${otp}\n\nThis code expires in 5 minutes. If you did not request this, you can ignore this email.`,
    html: `<p>Your Kyomi ${noun} is:</p><p style="font-size:24px;font-weight:600;letter-spacing:4px;">${otp}</p><p>This code expires in 5 minutes. If you did not request this, you can ignore this email.</p>`,
  };
}

/** Email the sign-in code. In development without a provider the code is logged instead. */
export const sendEmailOTP = (message: EmailOTPMessage) =>
  deliverEmail({
    to: message.to,
    content: createEmailOTPBody(message),
    label: "Email OTP",
    events: {
      development: "auth.email_otp.development_log",
      unconfigured: "auth.email_otp.delivery_unconfigured",
    },
    developmentLog: { otp: message.otp },
  });

/**
 * `sendEmailOTP` for a background delivery: a failure is logged and never escapes, because the
 * sign-in request that triggered it has already been answered.
 */
export const queueEmailOTP = (
  message: EmailOTPMessage,
): Effect.Effect<void, never, AppConfig | AppLogger | HttpClient.HttpClient> =>
  sendEmailOTP(message).pipe(
    Effect.asVoid,
    Effect.catch((error) =>
      AppLogger.use((log) =>
        log.error("auth.email_otp.delivery_failed", { error: serializeError(error) }),
      ),
    ),
  );

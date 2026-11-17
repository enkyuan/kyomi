import { Effect } from "effect";
import type { HttpClient } from "effect/http";
import { AppLogger } from "@adapters/logger/service";
import type { AppConfig } from "@config/env/service";
import { serializeError } from "@shared/errors/serialize";
import { deliverEmail } from "./resend";

type EmailOTPMessage = {
  to: string;
  otp: string;
};

export function createEmailOTPBody({ otp }: EmailOTPMessage) {
  return {
    subject: "Your Kyomi sign-in code",
    text: `Your Kyomi sign-in code is ${otp}\n\nThis code expires in 5 minutes. If you did not request this, you can ignore this email.`,
    html: `<p>Your Kyomi sign-in code is:</p><p style="font-size:24px;font-weight:600;letter-spacing:4px;">${otp}</p><p>This code expires in 5 minutes. If you did not request this, you can ignore this email.</p>`,
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

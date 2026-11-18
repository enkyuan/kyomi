import { emailOTP } from "better-auth/plugins";
import type { EmailOTPMessage } from "./otp";

const purposeOf = (type: string): NonNullable<EmailOTPMessage["purpose"]> =>
  type === "change-email"
    ? "change-email"
    : type === "email-verification"
      ? "verify-current-email"
      : "sign-in";

/**
 * The email OTP plugin. Signing in and changing the address are the only flows that send a code.
 *
 * `changeEmail` is Better Auth's own verified flow, and it takes two codes. The change is first
 * confirmed from the CURRENT mailbox (`type: "email-verification"`, passed to request-email-change
 * as `otp`), so a stolen or hijacked session alone cannot move the account to another mailbox and
 * lock its owner out; then the code sent to the NEW address must be entered, so nobody can claim an
 * address they cannot read. A signed-in user must never be able to set their email directly: an
 * unverified change lets them take an address before its owner signs up, and the owner's first
 * sign-in then lands in this account.
 */
export function emailOtpPlugin(sendOtp: (message: EmailOTPMessage) => void) {
  return emailOTP({
    changeEmail: { enabled: true, verifyCurrentEmail: true },
    sendVerificationOTP: async ({ email, otp, type }) => {
      sendOtp({ to: email, otp, purpose: purposeOf(type) });
    },
  });
}

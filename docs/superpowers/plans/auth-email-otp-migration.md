# Email OTP migration: Email + password → Email OTP

## Status: 📋 Planned (not yet implemented)

## Overview

The API currently authenticates users via Better Auth's `emailAndPassword`
plugin (`apps/api/src/adapters/auth/auth.ts`) with `emailAndPassword: {
enabled: true, revokeSessionsOnPasswordReset: true, sendResetPassword: … }`.
The web client (`apps/web/src/lib/auth/client.ts`) uses the same plugin:
`authClient.signIn.email({ email, password })` / `authClient.signUp.email({ … })`,
backed by login and register form pages with password fields.

This plan migrates the primary auth method to **email OTP** using Better
Auth's `emailOTP` plugin — a magic-code flow where the user enters their email,
receives a 6-digit code, and enters it to sign in (or auto-sign-up). Google
OAuth (`socialProviders`) stays enabled alongside OTP. Scope: `apps/api` and
`apps/web` only (no `packages/*`, `apps/mobile`, `docker/*`, or `tests/*`).

### Key findings from codebase exploration

- **`email-otp.ts` adapter already exists** at
  `apps/api/src/adapters/auth/email-otp.ts` with `sendEmailOTP`,
  `queueEmailOTP`, and `createEmailOTPBody`. It is NOT wired into `auth.ts`
  — it's dead code awaiting the plugin integration. It uses the same
  Resend delivery pattern as `reset-password.ts` and the same env vars
  (`AUTH_EMAIL_FROM`, `RESEND_API_KEY`).
- **Better Auth `emailOTP` plugin** is available in the installed `1.6.25`
  (`^1.5.3` in `package.json`). No version bump needed. The plugin's
  `sendVerificationOTP` callback receives `{ email, otp, type }` where
  `type` is `"sign-in" | "email-verification" | "forget-password" |
  "change-email"`.
- **No DB migrations required.** The emailOTP plugin stores OTP codes in
  the existing `verifications` table (see `packages/db/src/schema/auth.ts`).
  Better Auth's CLI `generate` is a no-op for this plugin.
- **Mobile already uses the OTP client flow** (`apps/mobile/src/lib/auth.ts`
  imports `emailOTPClient()`; the EmailSheet calls
  `authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" })`
  then `authClient.signIn.emailOtp({ email, otp })`). The web migration
  mirrors this established pattern.
- **Auth capabilities** currently expose `{ google, passwordReset,
  passwordResetUsesDevelopmentLog }` via `AUTH_CAPABILITIES_HEADER`. The
  migration replaces `passwordReset` / `passwordResetUsesDevelopmentLog`
  with `emailOtp` / `emailOtpUsesDevelopmentLog`.
- **Web auth UI**: two pages — `/` (Login, email+password form) and
  `/register` (Register, email+password+confirm form). No Google sign-in
  button is rendered on the web despite the capability flag. No
  password-reset or forgot-password routes exist.
- **Env vars** `AUTH_EMAIL_FROM` and `RESEND_API_KEY` are already declared
  and validated in `apps/api/src/config/env/runtime.ts` +
  `.env.example` (from the prior cherry-pick). `BETTER_AUTH_SECRET` is
  required; `BETTER_AUTH_URL` optional.

### Migration approach decisions (from `$better-auth-best-practices` + `$create-auth-skill`)

Per the Better Auth best-practices guide: plugins import from
`better-auth/plugins` (server) and `better-auth/client/plugins` (client);
re-run `better-auth/cli@latest generate` after adding plugins; and the
emailOTP plugin's `sendVerificationOTP` should not block the response
(fire-and-forget via `queueEmailOTP`). Per the `create-auth-skill` Phase 2
decision tree this is a **migrating from another auth library** scenario (migrating
from `emailAndPassword` to `emailOTP`), so we keep `emailAndPassword`
config present but set `enabled: false` for a soft cutover rather than full
removal — preserves the config surface for rollback.

## Implementation approach

### Step 1 — API: enable `emailOTP` plugin in auth config

File: `apps/api/src/adapters/auth/auth.ts`

Disable `emailAndPassword` and add the `emailOTP` **plugin** (imported from
`better-auth/plugins`) to the `plugins` array. Wire `sendVerificationOTP`
to the existing `queueEmailOTP` from `./email-otp`:

```ts
import { emailOTP } from "better-auth/plugins";
import { queueEmailOTP } from "./email-otp";
// … existing imports (remove queueResetPasswordEmail) …

export const auth = betterAuth({
  // … existing secret, baseURL, trustedOrigins, advanced, databaseHooks, database …
  emailAndPassword: { enabled: false },          // Step 4: explicitly disabled
  plugins: [
    emailOTP({
      sendVerificationOTP: async ({ email, otp, type }) => {
        void queueEmailOTP({ to: email, otp });
      },
      // type is "sign-in" | "email-verification" | "forget-password" |
      // "change-email". For this migration only the "sign-in" path is
      // used by the web client. Other types are available for future use.
    }),
  ],
  socialProviders: resolveGoogleSocialProvider({            // unchanged
    enabled: env.FEATURE_GOOGLE_OAUTH,
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  }),
  // … existing session additionalFields …
});
```

**Reasoning:** The `emailOTP` plugin is a Better Auth *plugin* (not a core
config block), so it goes in the `plugins: [...]` array. The
`sendVerificationOTP` callback delegates to `queueEmailOTP` — the
same function the dead `email-otp.ts` file was written for. We
`void` the promise (fire-and-forget) to avoid timing attacks, matching
the Better Auth best-practices note that email sending should not block
the response. The `type` parameter is available for future
type-specific email templates but the default "sign-in code" message in
`createEmailOTPBody` is sufficient for the migration.

### Step 2 — API: wire `email-otp.ts` into the auth barrel

File: `apps/api/src/adapters/auth/index.ts`

```ts
export * from "./auth";
export * from "./capabilities";
export * from "./location";
export * from "./email-otp";   // Step 2: surface the OTP delivery helpers
```

**Reasoning:** `email-otp.ts` currently exists but is unreferenced. The
`queueEmailOTP` function is used by `auth.ts` (Step 1 import) and
may be needed by future OTP-type handlers (e.g. if we later wire
`emailVerification`). Re-exporting makes it part of the adapter's
public surface for testing and downstream use.

### Step 3 — API: update auth capabilities

File: `apps/api/src/adapters/auth/capabilities.ts`

Replace the `passwordReset` / `passwordResetUsesDevelopmentLog`
capability fields with `emailOtp` / `emailOtpUsesDevelopmentLog`:

```ts
export type AuthCapabilities = {
  google: boolean;
  emailOtp: boolean;
  emailOtpUsesDevelopmentLog: boolean;
};

export function resolveAuthCapabilities({
  googleOAuthEnabled,
  nodeEnv,
  resendApiKey,
  emailFrom,
}: {
  googleOAuthEnabled: boolean;
  nodeEnv: "development" | "production" | "test";
  resendApiKey?: string;
  emailFrom?: string;
}): AuthCapabilities {
  const hasEmailDelivery = Boolean(resendApiKey && emailFrom);
  return {
    google: googleOAuthEnabled,
    emailOtp: true,                                  // always available
    emailOtpUsesDevelopmentLog: nodeEnv !== "production" && !hasEmailDelivery,
  };
}
```

**Reasoning:** Email OTP is always available in every environment (dev
falls back to the console log path in `sendEmailOTP`). The
`emailOtpUsesDevelopmentLog` flag mirrors the old
`passwordResetUsesDevelopmentLog` semantics — true when running outside
production without Resend configured. The `passwordReset` /
`passwordResetUsesDevelopmentLog` fields are removed since there are no
more password-based flows.

### Step 4 — API: disable `emailAndPassword`

File: `apps/api/src/adapters/auth/auth.ts`

Set `emailAndPassword: { enabled: false }` and remove the
`sendResetPassword` callback. Remove the `import { queueResetPasswordEmail }`
import. Keep `reset-password.ts` on disk (no deletion) — it is no longer
imported by `auth.ts` and becomes dead code; a future cleanup PR can
remove it.

**Reasoning:** The `emailOTP` plugin fully replaces password-based
authentication. Setting `enabled: false` (rather than deleting the block)
keeps the config surface intact for an easy rollback. The
`sendResetPassword` callback is only invoked by the `emailAndPassword`
plugin, so it is dead once the plugin is disabled. The `reset-password.ts`
adapter file is kept (not deleted) to minimise scope and because it
shares the same Resend delivery pattern that `email-otp.ts` already
duplicates — a future PR can consolidate both into a shared email
helper.

### Step 5 — Web: add `emailOTPClient` plugin to the auth client

File: `apps/web/src/lib/auth/client.ts`

```ts
import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

const baseURL =
  typeof window === "undefined"
    ? undefined
    : `${window.location.protocol}//${window.location.host}`;

export const authClient = createAuthClient({
  baseURL,
  plugins: [emailOTPClient()],
  sessionOptions: {
    refetchInterval: 5 * 60,
  },
});
```

**Reasoning:** The `emailOTPClient()` plugin adds
`authClient.emailOtp.sendVerificationOtp()` and
`authClient.signIn.emailOtp()` to the client's typed API. Without it,
the web app cannot call the email OTP endpoints. This mirrors the
mobile client (`apps/mobile/src/lib/auth.ts`) which already imports
`emailOTPClient()`. The plugin is imported from
`better-auth/client/plugins` per the tree-shaking guidance in
`$better-auth-best-practices`.

### Step 6 — Web: define OTP form schemas (local to `apps/web`)

Files: `apps/web/src/modules/auth/schema.ts` (extend the re-export)

Add OTP-specific form types and validators alongside the existing
re-exports from `@kyomi/reader/schemas/auth`. Define them **locally** in
`apps/web/src/modules/auth/schema.ts` (not in `packages/reader`, to keep
scope within `apps/web`):

```ts
import { isValidEmail } from "@kyomi/reader/schemas/auth";

export type EmailOTPFormValues = { email: string };
export type OtpFormValues = { otp: string };

function normalizeEmail(value: string) { return value.trim(); }

export function emailOtpFormValidator({ value }: { value: EmailOTPFormValues }) {
  const normalized = normalizeEmail(value.email);
  if (!isValidEmail(normalized)) {
    return { fields: { email: "Enter a valid email address" } };
  }
  return { fields: {}, values: { email: normalized } };
}

export function otpFormValidator({ value }: { value: OtpFormValues }) {
  const otp = value.otp.trim();
  if (!otp) {
    return { fields: { otp: "Code is required" } };
  }
  // 6-digit numeric code matches the emailOTP plugin's otpLength default (6)
  if (!/^\d{6}$/.test(otp)) {
    return { fields: { otp: "Enter the 6-digit code sent to your email" } };
  }
  return undefined;
}

export const emailOtpDefaultValues: EmailOTPFormValues = { email: "" };
export const otpDefaultValues: OtpFormValues = { otp: "" };
```

**Reasoning:** The new form types are web-specific (mobile uses a native
`EmailSheet` with `useNativeState`, not TanStack forms). The email validator
reuses `isValidEmail` (already exported from `@kyomi/reader/schemas/auth`)
and `normalizeEmail` (re-declared locally — a trivial one-liner). The OTP
validator enforces a strict 6-digit numeric code matching the server-side
`otpLength` default. Keeping these in the web module avoids touching
`packages/reader`.

### Step 7 — Web: refactor Login to a two-step email → OTP flow

File: `apps/web/src/modules/auth/components/login/index.tsx`

Replace the single email+password form with a two-step component:
**Step 1 (email):** email input → calls
`authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" })`
→ on success, advance to Step 2.
**Step 2 (OTP):** 6-digit code input → calls
`authClient.signIn.emailOtp({ email, otp, callbackURL: returnTo })`
→ on success, invalidate router + prefetch inbox + navigate to `returnTo`.

```ts
// Step 1 submit
const result = await authClient.emailOtp.sendVerificationOtp({
  email: value.email,
  type: "sign-in",
});
if (result.error) {
  throw new Error(result.error.message?.trim() || "Could not send sign-in code");
}
setStep("otp");

// Step 2 submit
const result = await authClient.signIn.emailOtp({
  email,
  otp: value.otp,
  callbackURL: returnTo,
});
if (result.error) {
  throw new Error(result.error.message?.trim() || "Invalid code");
}
await Promise.all([router.invalidate(), prefetchInboxFlow(router, queryClient)]);
await router.navigate({ href: returnTo });
```

The password field and eye-toggle UI are removed. A "Resend code" link
calls `sendVerificationOtp` again. The error toast messages change from
"Invalid email or password" to "Could not send sign-in code" / "Invalid
code".

**Reasoning:** This two-step pattern mirrors the mobile `EmailSheet`
(Step 1: `handleSendCode` → `sendVerificationOtp`; Step 2:
`handleVerifyCode` → `signIn.emailOtp`), providing a consistent
developer and user experience. The `callbackURL` is passed to
`signIn.emailOtp` so Better Auth redirects post-auth on its own (same
as the old `signIn.email({ callbackURL })`).

### Step 8 — Web: remove / redirect the Register route

Files: `apps/web/src/routes/register.tsx`,
`apps/web/src/modules/auth/components/register/index.tsx`,
`apps/web/src/modules/auth/redirect.ts`,
`apps/web/src/modules/auth/index.ts`

- Since the email OTP flow auto-creates users who don't yet have an
  account (`disableSignUp` defaults to `false`), a separate Register page
  is no longer needed.
- `apps/web/src/routes/register.tsx`: replace the route component with a
  redirect to `/` (login) with the same `redirect` search param:

```ts
export const Route = createFileRoute("/register")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/",
      search: { redirect: search.redirect },
    });
  },
  // no component — immediate redirect
});
```

- `apps/web/src/modules/auth/redirect.ts`: simplify
  `buildAuthEntryHref` to accept only `"/"`:
  `export function buildAuthEntryHref(returnTo: unknown) { … }`
- Delete `apps/web/src/modules/auth/components/register/index.tsx` and
  remove the `export { Register }` from the barrel
  (`apps/web/src/modules/auth/index.ts`).

**Reasoning:** OTP auth unifies sign-in and sign-up into one flow
(same as the mobile app, which has no "register" step). The Register page
becomes a legacy URL that redirects to login. This also removes the
password + confirm-password fields from the UI surface, consistent with
the `emailOtpFormValidator` / `otpFormValidator` in Step 6.

### Step 9 — Web: update auth capabilities consumer

Files: `apps/web/src/lib/auth/capabilities.ts`,
`apps/web/src/routes/__root.tsx`,
`tests/web/integration/src/lib/auth/capabilities.test.ts` (NOT in scope —
leave test file unchanged)

Update the web-side capability type to match the API:

```ts
export type AuthCapabilities = {
  google: boolean;
  emailOtp: boolean;
  emailOtpUsesDevelopmentLog: boolean;
};

export const DEFAULT_AUTH_CAPABILITIES: AuthCapabilities = {
  google: false,
  emailOtp: false,
  emailOtpUsesDevelopmentLog: false,
};

export function parseAuthCapabilities(value: string | null): AuthCapabilities {
  const enabled = new Set(
    value?.split(",").map((c) => c.trim()).filter(Boolean) ?? [],
  );
  return {
    google: enabled.has("google"),
    emailOtp: enabled.has("emailOtp"),
    emailOtpUsesDevelopmentLog: enabled.has("emailOtpUsesDevelopmentLog"),
  };
}
```

`__root.tsx` needs no code changes — it already passes `authCapabilities`
through generically. The `getAuthBootstrapState` server function
already returns `{ authState, authCapabilities }` unchanged.

**Reasoning:** The capabilities header is parsed generically; only the
type shape and string keys change. `__root.tsx` destructures
`authCapabilities` generically and doesn't reference individual fields,
so it's forward-compatible. Tests are out of scope but will need
updating to match the new capability names.

### Step 10 — No DB migrations required

The `emailOTP` plugin stores OTP codes in Better Auth's `verifications`
table, which already exists in
`packages/db/src/schema/auth.ts` (`id`, `identifier`, `value`,
`expiresAt`, `createdAt`, `updatedAt`). No new tables or columns are
needed. `npx @better-auth/cli@latest generate` produces no schema diff
for this plugin.

**Reasoning:** Per `$better-auth-best-practices`, re-run the CLI after
adding a plugin. In this case the CLI confirms no migration is needed,
so the step is a verification rather than a migration.

## Testing strategy

API: `bun test ../../tests/api/integration/adapters/auth/` — update
`capabilities.test.ts` to expect `emailOtp`/`emailOtpUsesDevelopmentLog`
instead of `passwordReset`/`passwordResetUsesDevelopmentLog`; change the
`routes.test.ts` header assertion from `"passwordReset"` to `"emailOtp"`.
Add `email-otp.test.ts` (Resend HTTP mock, dev-log fallback, delivery
failure) mirroring `reset-password.test.ts`. Web:
`vitest run --config web/vitest.config.ts src/lib/auth/` — update the web
capabilities parse test; add a Login two-step component test mocking
`sendVerificationOtp` and `signIn.emailOtp`. Run `bun run typecheck`
on both apps after each change.

## Manual review / refinement notes

`$plan-tune` is not available in this skill set (confirmed via skill
directory listing). This review was done manually against the
`$better-auth-best-practices` and `$create-auth-skill` guidance loaded
above:

- **Plugin import paths**: `emailOTP` from `better-auth/plugins` (server),
  `emailOTPClient` from `better-auth/client/plugins` (client) — follows the
  tree-shaking import convention.
- **Plugin config**: `sendVerificationOTP` callback is async and
  fire-and-forget (`void queueEmailOTP(...)`) — matches the "don't await
  email delivery" best practice.
- **Migration pattern**: soft cutover (`emailAndPassword: { enabled: false }`)
  rather than deletion — matches `create-auth-skill` "migrating from
  another auth library" guidance for incremental migration.
- **No schema/migration needed**: emailOTP uses the `verifications`
  table — confirmed against the plugin type definitions in
  `node_modules/better-auth/dist/plugins/email-otp`.
- **Scope compliance**: changes touch only `apps/api/src/adapters/auth/`
  and `apps/web/src/{lib/modules/routes}/auth*`. Test file updates are
  noted as out-of-scope but listed for the implementer. `packages/*`,
  `apps/mobile`, `docker/*`, and `tests/*` are not modified.

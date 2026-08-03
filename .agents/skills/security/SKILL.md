---
name: security
description: Assess, design, implement, review, or verify security-sensitive Kyomi changes. Use for authentication, authorization, sessions, cookies, trusted origins, OAuth and password recovery, public API routes, user or organization data access, secrets and environment files, logging and redaction, rate limits, queue payloads, outbound feed or favicon requests, SSRF controls, untrusted article HTML and URLs, third-party providers, database migrations, WebView bridges, native storage, dependency risk, or any change to a trust boundary across web, mobile, API, packages, and Docker. Not a substitute for a formal security scan when the user requests one.
---

# Security

Protect Kyomi's actual trust boundaries while preserving legitimate product behavior.

## Establish the contract

1. Read `AGENTS.md`, the owning skill, affected entrypoints and callers, tests, environment examples,
   and existing auth, network, sanitization, or redaction controls.
2. Trace attacker-controlled input through parsing, authentication, authorization, domain behavior,
   storage, queues, outbound calls, rendering, native bridges, and logs.
3. Name the asset, principal or tenant, trust boundary, preconditions, sensitive sink, closest
   control, required invariant, and legitimate behavior that must remain.
4. Separate a confirmed reachable vulnerability from a hardening opportunity or unsupported
   hypothesis.

## Preserve Kyomi controls

- Treat browser and Expo route guards as navigation behavior, never data authorization.
- Authenticate and authorize every user-owned read or mutation at the API boundary. Scope access by
  the authenticated principal, not a client-supplied user ID.
- Keep secrets out of `VITE_`, responses, errors, logs, fixtures, snapshots, and committed
  plaintext. Use `$environment` for dotenvx changes.
- Validate request inputs, queue payloads, and provider responses at their boundaries.
- Give public or costly actions appropriate authorization, rate limiting, idempotency, and replay
  controls; validation alone is not abuse prevention.
- Reuse `apps/api/src/shared/net` controls for attacker-influenced URLs. Apply finite DNS, redirect,
  address, size, timeout, retry, and cancellation policies.
- Preserve SSRF-safe favicon and feed fetching. Re-check every redirect hop and alternate address
  class when behavior changes.
- Keep article HTML sanitization browser-safe and conservative. Treat raw HTML, URL resolution,
  WebView bridges, and navigation as untrusted boundaries.
- Preserve credentialed CORS, trusted origins, cookies, callbacks, and account-linking semantics as
  one auth contract.
- Keep database operations parameterized and tenant-scoped. Review migrations for exposure,
  destructive behavior, defaults, and rollback.
- Redact tokens, cookies, OTPs, request bodies, provider payloads, and decrypted environment values.
- Treat MMKV and native bridges as persistence and code-execution boundaries, not ordinary React
  state.

## Verify before reporting safe

1. Use `$testing` with the owner skill to exercise the attacker condition through the narrowest real
   boundary.
2. Test a legitimate control through the same path.
3. Test a relevant bypass class or sibling entrypoint when evidence supports it.
4. Run focused owner and cross-boundary contract tests.
5. Finish through `$qa`.

Report reachability, impact, confidence, affected paths, existing controls, verification, and
remaining uncertainty.

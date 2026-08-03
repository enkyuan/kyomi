---
name: environment
description: Add, change, validate, encrypt, document, or debug Kyomi environment variables and feature flags. Use for docker/.env and docker/.env.example, apps/api/.env and its typed runtime schema, apps/web/.env and browser-safe configuration, dotenvx get or set workflows, encrypted values and key handling, Compose configuration, Drizzle environment loading, CI environment preparation, Turbo task environment contracts, missing or paired configuration, and distinguishing public values from secrets. Pair with the owning app or package skill and security for secret or trust-boundary changes.
---

# Environment

Treat every environment variable as a contract spanning storage, validation, consumers, execution,
tests, and documentation.

## Locate ownership

| File or boundary                     | Owner                                                        |
| ------------------------------------ | ------------------------------------------------------------ |
| `docker/.env` and `.env.example`     | Shared local infrastructure and safe defaults                |
| `apps/api/.env` and `.env.example`   | Host-side API, worker, scheduler, and provider configuration |
| `apps/api/src/config/env/runtime.ts` | Typed server parsing, defaults, and paired-value validation  |
| `apps/web/.env` and `.env.example`   | Web server and intentionally public browser configuration    |
| `apps/web/src/env.ts`                | Typed web environment values                                 |
| `packages/db/drizzle.config.ts`      | Database URL resolution for Drizzle commands                 |
| `scripts/ci/prepare-env.ts`          | Deterministic CI placeholders                                |
| `docker/docker-compose.yml`          | Container injection and infrastructure defaults              |

Mobile has no established environment contract yet. Use `$architecture`, `$mobile`, and `$security`
before introducing one.

## Classify first

Classify a new value as one of:

- shared infrastructure;
- server secret;
- server configuration;
- intentionally browser-visible `VITE_` value;
- build or CI-only configuration;
- optional feature flag plus its required credentials.

Never expose a secret through `VITE_`, source code, a response, logs, snapshots, or example files.

## Change the full contract

1. Read the owning `.env.example`, parser, consumer, scripts, tests, Compose mapping, and workspace
   README.
2. Add only a safe non-secret default or empty placeholder to an example file.
3. Add explicit parsing, validation, defaults, and production-safe failure to the owning schema.
4. Update every consumer, Compose or process mapping, CI placeholder, task contract, and nearby
   documentation that depends on the value.
5. Add tests for valid, missing, malformed, and incomplete paired configuration.
6. Add a Turbo environment entry only when task passthrough or hashing actually requires it; do not
   edit `turbo.json` ritualistically.

## Use dotenvx safely

Use the repository-installed binary through Bun:

```sh
bun run dotenvx set KEY "value" -f apps/api/.env
bun run dotenvx get KEY -f apps/api/.env
```

- Select `docker/.env`, `apps/api/.env`, or `apps/web/.env` according to ownership.
- Let `dotenvx set` encrypt by default. Append `--plain` only when plaintext is intentionally safe.
- Do not use generic `bunx` examples for encrypted Kyomi get or set operations.
- Do not print, paste, decrypt, or request a real secret in agent logs or chat. Ask the repository
  owner to run `set` in a trusted shell when plaintext must stay outside the agent context.
- Never commit `.env.keys`, `DOTENV_PRIVATE_KEY`, decrypted output, or production credentials.
- Never use `SKIP_ENV_VALIDATION=true` in production.

## Verify

1. Run the focused parser or consumer test.
2. Run `bun run check:env`.
3. Run the owning app's typecheck and build.
4. Validate Compose configuration when container injection changes.
5. Run `bun run env:encrypt` only when the requested change needs repository encryption refreshed.
6. Finish through `$qa`.

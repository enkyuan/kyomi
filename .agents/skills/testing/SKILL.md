---
name: testing
description: Design, write, review, move, or improve Kyomi tests and fixtures. Use for regression coverage, choosing the narrowest real boundary, structuring tests under tests/web or tests/api, mirroring app domains, testing packages/ui, packages/reader, packages/db, or packages/worker through their owning runner, adding success and failure cases, handling time, retries, concurrency, auth, network, or database behavior, activating e2e coverage, or introducing the first mobile or catalog test runner. Pair with web, mobile, api, packages, security, or architecture while implementing behavior; use qa afterward for aggregate verification.
---

# Testing

Write the smallest test that fails for the intended reason and survives internal refactoring.

## Establish the behavior

1. Read `AGENTS.md`, `tests/README.md`, the owning source, its public boundary, and the closest tests.
2. Name the owner, observable behavior, caller, material failure modes, and regression risk before
   selecting a runner or mock.
3. Load `$architecture` before adding a runner, shared harness, new top-level layer, public fixture
   contract, or test ownership convention.
4. Pair this skill with the owning `$web`, `$mobile`, `$api`, or `$packages` skill.

## Use the current test tree

```text
tests/
  web/
    integration/src/        Vitest and Testing Library with jsdom
      app/
      integrations/
      lib/
      modules/<domain>/
      packages/<package>/
      routes/
    e2e/                    Wired extension point; add only for a real running journey
  api/
    integration/            Bun Test, mirroring backend ownership
      adapters/
      app/
      config/
      db/
      modules/<domain>/
      shared/
    fixtures/               Shared non-test assets
    e2e/                    Wired extension point; add only for a real process journey
```

- Keep all TypeScript tests under `tests`; do not add `*.test.*`, `*.spec.*`, or `__tests__`
  directories beside production code.
- Mirror `apps/web/src` below `tests/web/integration/src`.
- Mirror `apps/api/src` below `tests/api/integration` when the API owns the behavior.
- Put direct shared UI and reader package contracts under
  `tests/web/integration/src/packages/<package>`.
- Put database schema behavior under `tests/api/integration/db`. Put worker behavior under the
  observable API module, job, queue, feed, or favicon boundary it serves.
- Keep large shared HTML or protocol assets in `tests/api/fixtures`; keep small test-local builders
  beside the owning test.

## Name test files

- Use `*.test.ts` and `*.test.tsx`. The Vitest config also accepts `*.spec.*`, but prefer the
  repository's established `*.test.*` form.
- Match the source responsibility: `options.test.ts`, `routes.test.ts`, `workflow.test.ts`, or
  another precise behavior name.
- Name fixtures, builders, scoring helpers, and setup files without `.test` so runners do not
  collect them.
- Use snake*case and `test*\*.py` if a Python suite is deliberately introduced.

## Design durable coverage

- Assert public behavior, protocol, state transition, or an intentional design-system contract.
- Reproduce a bug before fixing it when practical.
- Cover the success path and material negative paths: invalid input, absent identity, denied access,
  dependency failure, timeout, cancellation, retry, duplicate execution, or stale state as relevant.
- Inject transports, clocks, randomness, and storage at real seams. Avoid mocking long internal call
  chains.
- Keep tests deterministic, isolated, order-independent, and safe for parallel runs. Clean timers,
  globals, temporary files, processes, and persisted state.
- Use accessible roles, labels, and user-visible state for UI behavior.
- Never place real secrets, decrypted environment values, or mutable production data in fixtures.

## Use the owning runner

| Owner                 | Location                    | Runner                                             |
| --------------------- | --------------------------- | -------------------------------------------------- |
| Web, UI, reader-web   | `tests/web/integration/src` | Vitest + Testing Library + jsdom                   |
| API, database, worker | `tests/api/integration`     | Bun Test through the API environment               |
| Mobile                | Not wired                   | Select and wire one runner through `$architecture` |
| Catalog Python        | Not wired                   | Select one pytest layout through `$architecture`   |

Run focused web tests with:

```sh
bun run --cwd tests test:web:integration -- integration/src/<path>.test.ts
```

The API wrapper currently includes the whole integration directory even when a file argument is
appended. For a truly focused API test, run from the API environment:

```sh
cd apps/api
bun run dotenvx run -f ../../docker/.env -f .env -- \
  bun test ../../tests/api/integration/<path>.test.ts
```

Then run the declared broad command with `bun run test:web`, `bun run test:api`, or
`bun run test` as the change scope requires. Finish through `$qa`.

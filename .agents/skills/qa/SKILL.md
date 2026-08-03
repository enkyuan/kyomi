---
name: qa
description: Validate, review, document, and checkpoint Kyomi changes. Use after web, mobile, API, package, test, environment, security, design, dependency, migration, Docker, or documentation work; for choosing focused verification, checking repository structure and package exports, running formatting, linting, typechecking, boundary checks, tests, builds, Drizzle drift checks, environment checks, and Compose validation; for distinguishing product regressions from unrelated dirty-workspace or environment failures; and for creating a focused local GitButler checkpoint. Not for designing architecture or test behavior, and not for pushing or opening a pull request unless the user asks.
---

# QA

Produce evidence for the requested change without absorbing unrelated workspace work.

## Scope verification

1. Read `AGENTS.md`, the owning skill, affected manifests and READMEs, and the changed tests.
2. Inspect changes with GitButler and preserve every unrelated file, hunk, branch, and generated
   artifact owned by another session.
3. Map each changed file to its app or package owner, test surface, generated output, environment
   contract, and runtime.
4. Confirm placement-changing work used `$architecture`, behavior used `$testing`, and
   security-sensitive or environment work used its specialist skill.

## Run focused checks first

- Use declared workspace scripts rather than inventing parallel tool invocations.
- Run the narrowest changed test first.
- Run the owning workspace's `typecheck`, `lint`, and `fmt:check`.
- Build the affected app when routes, SSR, native configuration, environment values, package
  exports, or production bundling changed.
- Run `bun scripts/ci/drizzle-drift.ts` for schema or migration work.
- Run `bun run check:env` for environment-file changes.
- Validate Docker Compose configuration before relying on container behavior.
- Run both producer and consumer checks when a package, API, queue, reader, or environment contract
  crosses workspaces.

## Finish proportional gates

Use the smallest sufficient matrix, then broaden for cross-workspace or ship-ready changes:

```sh
bun run fmt:check
bun run lint
bun run check:boundaries
bun run typecheck:app
bun run test
bun run build
```

`bun run ci:static` also prepares local environment files. Use it only when CI-equivalent validation
is required and its environment-file behavior is safe for the current workspace.

If a broad gate fails outside the changed surface, reproduce the requested path with focused checks
and report the exact unrelated product, tooling, environment, stale-report, or missing-external-
evidence blocker. Do not edit another session's work to make an aggregate command green.

## Check repository organization

- Confirm each path has one domain and workspace owner.
- Confirm route, boot, and composition files remain thin.
- Confirm packages import no app internals and consumers use declared exports.
- Confirm tests remain under the owner-first `tests/web` or `tests/api` tree.
- Confirm generated files came from their owning generator.
- Confirm moves update imports, exports, tests, documentation, and removal of the old path.
- Reject empty anticipatory folders and generic cross-domain dumping grounds.

## Create the checkpoint

1. Run `but diff` and collect only the exact file or hunk IDs created by this session.
2. Create one dedicated branch and checkpoint with:

   ```sh
   but commit <name>/<short-description> -c -m "type(scope): summary" --changes <id>,<id>
   ```

3. Trust the workspace state printed by the successful GitButler command. Do not run routine status
   commands afterward unless its output lacks required information.
4. Keep tests with the behavior they verify and split unrelated changes by hunk or coherent commit.
5. Do not push or open a pull request unless the user asks.

Report the behavior verified, exact commands and outcomes, unrelated blockers, generated or
environment caveats, and the local checkpoint branch and commit.

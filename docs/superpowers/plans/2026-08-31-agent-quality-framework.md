# Kyomi Agent Quality and Documentation Framework Implementation Plan

## Outcome

Give every Kyomi implementation task one lightweight, repeatable workflow:

1. establish the real owner and local context;
2. retrieve version-matched, first-party framework and platform guidance;
3. implement through an existing Kyomi seam before creating one;
4. validate with deterministic, affected-scope checks; and
5. use a small Pi guard to prevent obvious repository bloat and unsafe direct writes.

The framework improves agent decisions. It does not claim that a prompt hook can prove an agent read documentation or prevent every possible filesystem mutation.

## Goals

- Make relevant repository context and official documentation routine prerequisites for non-trivial work.
- Keep generated code aligned with the installed API surface, vendor-recommended idioms, platform conventions, and Kyomi ownership rules.
- Keep new files shallow, intentionally owned, consistently named, and free of speculative abstractions.
- Reuse the existing quality commands, CI jobs, skills, and boundary checker instead of creating another quality subsystem.
- Version the project-local Pi guidance and guard at `.pi/extensions/kyomi.ts`.

## Non-goals

- Mirroring or committing third-party documentation.
- Treating tutorial code as a template to copy verbatim.
- Making documentation retrieval, model review, or a subjective simplicity score a CI gate.
- Intercepting arbitrary shell, custom-tool, IDE, or external-process mutations.
- Replacing existing lint rules, test ownership, or CI jobs.
- Adopting Coss UI or adding any framework dependency.

## Confirmed repository facts

- `AGENTS.md` already routes substantial work to a narrow project-local owner skill.
- `.agents/skills` is the canonical implementation guidance. Its architecture reference already defines ownership, naming, exports, generated artifacts, and test placement.
- Root scripts already provide `fmt:check`, `lint`, `check:boundaries`, `typecheck:app`, `test`, `build`, and `ci:static`; GitHub Actions runs static quality, web/API integration tests, builds, and Docker builds.
- `scripts/check-boundaries.ts` checks selected source roots, package-to-app imports, and deep `@kyomi/*/src/*` imports. It currently omits `packages/db/src` and `packages/reader/src`.
- Oxlint already warns for filename case, line count, complexity, and depth. Raising those warnings to errors would block existing code unrelated to this framework.
- `.gitignore` currently ignores `.pi/` twice, so a project extension would not be committed without a narrow exception.
- Pi 0.84.4 supports project-local extensions, `before_agent_start` context injection, and `tool_call` blocking for direct `edit` and `write` calls. Loading a project extension is a trust decision, so it must not be executed in CI from untrusted pull-request content.

## Design decisions

### Documentation is a context stage, not a static document store

For framework-sensitive work, the agent must retrieve the smallest set of authoritative material needed for the requested behavior. “Fetch as much context as possible” means broad enough to cover the feature’s real boundaries, not an unbounded crawl that fills context with unrelated documentation.

Before editing, collect:

- the owner skill, workspace README, manifest, relevant source and callers, package exports, and closest tests;
- the resolved package version and installed declarations/source for the API that will be called;
- the exact official documentation pages for the API, lifecycle, platform behavior, or design decision involved; and
- existing Kyomi patterns that intentionally diverge from vendor examples.

### Source-of-truth order

| Concern | Authority | Reason |
| --- | --- | --- |
| Callable API, prop, modifier, runtime availability | Installed package version and `.d.ts`/source | The lockfile determines what will execute. |
| Recommended framework usage | Official documentation matching the installed major/minor version | Examples and patterns evolve independently of Kyomi. |
| Native behavior, accessibility, navigation, interaction | Apple HIG/SwiftUI and Android Compose/Material 3 guidance | Platform conventions are product requirements, not decoration. |
| Ownership, exports, naming, app/package boundaries, existing product conventions | Kyomi `AGENTS.md`, owner skills, and established nearby code | Vendor examples do not know Kyomi’s architecture. |

When sources disagree, resolve the installed version first. If a documented approach does not exist in that version, use the matching version’s documentation or changelog. Do not hide the mismatch behind an undocumented workaround.

### Framework source map

| Scope | Required first-party references when applicable | Notes |
| --- | --- | --- |
| `apps/web` | TanStack Start, Router, and Query official docs | Read the exact installed `@tanstack/*` versions first. Router search validation, loader/server boundaries, and Query cache updates need their own page-level evidence. |
| `apps/web` / `packages/ui` | Coss UI and Base UI docs only if explicitly evaluating or using them | Coss is not a current Kyomi dependency and is early-development, copy-and-own software. It must not appear in a feature incidentally. |
| `apps/mobile` | Expo SDK 57 docs, Expo UI, Expo Router, Expo Modules, Uniwind | Start universal with `@expo/ui`; inspect installed types for every native component/modifier. Isolate SwiftUI and Compose imports in platform files. |
| iOS mobile presentation | Apple HIG and SwiftUI documentation | Apply platform behavior, accessibility, Dynamic Type, and control conventions without erasing Kyomi’s content hierarchy and tokens. |
| Android mobile presentation | Android Compose and Material 3 documentation | Apply adaptive layout, state, semantic color, component, and feedback conventions without copying an unrelated app design. |

Prefer official Markdown endpoints and `llms.txt` indexes where supplied. Expo exposes a Markdown index and page-level Markdown; Uniwind exposes `llms.txt`. Fetch a relevant page from the index rather than ingesting a whole site. Record URLs and access date in the implementation report, not as checked-in snapshots.

### Documentation evidence format

Every non-trivial framework or platform change must end with a concise evidence block in the agent report or pull request description:

```text
Documentation evidence
- Owner/context: <owner skill, affected module, nearby pattern>
- Runtime proof: <package and resolved version; declaration/source inspected>
- Official references: <2–4 URLs, accessed YYYY-MM-DD>
- Applied contract: <API/platform rule used>
- Kyomi divergence: <none or explicit reason>
- Verification: <focused commands and observable result>
```

The evidence makes review possible without creating a permanent, stale documentation mirror.

### Enforcement layers

| Layer | Responsibility | Limits |
| --- | --- | --- |
| Project guidance | `AGENTS.md` and owner skills define the context, documentation, ownership, naming, and test workflow. | Guidance cannot technically prove compliance. |
| Pi extension | Reminds the active agent of the framework and blocks clearly unsafe direct `edit`/`write` paths. | It cannot safely interpret every shell command or confirm a skill was loaded. |
| Deterministic checks | Existing formatting, lint, import-boundary, type, test, build, and CI gates catch objective regressions. | They do not judge every architecture or product decision. |
| Review | A fresh read-only Pi review may challenge the diff after deterministic checks pass. | It is opt-in advice, not CI or a merge condition. |

## Task 0: Protect the shared working tree

1. Inspect `but diff` and `git status` before each implementation task.
2. Identify exact file or hunk ownership and do not absorb the existing mobile, API, Xcode, or lockfile work into this framework.
3. Create and validate the framework on its own branch or GitButler checkpoint.

**Acceptance:** no unrelated dirty file, staged hunk, generated native artifact, or existing mobile work is reformatted, reverted, staged, or committed by this work.

## Task 1: Define the feature-start context contract

**Files:** `AGENTS.md`

1. Add one concise “Agent implementation framework” section after the skill-routing section.
2. Require, before a substantial implementation change:
   - classify the owner and trust boundaries;
   - load the smallest applicable project skills;
   - inspect the workspace manifest, nearby implementation, callers/consumers, exports, and closest tests;
   - retrieve version-matched official documentation when a framework/platform API is involved; and
   - state the intended owner, existing seam, and affected verification surface before writing.
3. Require the documentation evidence format in completion reports for framework-sensitive changes.
4. Point to owner skills for exact workflow. Do not duplicate the architecture reference or a catalog of every framework in `AGENTS.md`.

**Acceptance:** one short global contract routes agents to the existing owner skills and does not create another architecture guide.

## Task 2: Put framework-specific source maps beside the owner skills

**Files:**

- `.agents/skills/web/SKILL.md`
- `.agents/skills/web/references/dependencies.md` (new)
- `.agents/skills/mobile/SKILL.md`
- `.agents/skills/mobile/references/dependencies.md`

1. Add a small web reference linked from the web skill.
   - Require reading `apps/web/package.json` and installed declarations before using TanStack Start, Router, or Query APIs.
   - Map common concerns to the correct official docs: Start for server/SSR behavior, Router for route/search/loader behavior, Query for cache, mutation, and invalidation behavior.
   - List Coss UI as an **evaluation-only** source. Its use requires an explicit adoption decision; it cannot bypass `@kyomi/ui` ownership or introduce direct dependency drift.
2. Extend the existing mobile dependency reference rather than creating another mobile framework guide.
   - Keep Expo SDK 57 as the versioned documentation baseline until the manifest changes.
   - Require Expo UI type inspection and universal-first selection before SwiftUI/Compose seams.
   - Add source links and retrieval rules for Expo Modules, Uniwind, Apple HIG/SwiftUI, and Android Compose/Material 3.
3. Update the mobile skill’s establish-context step to require the relevant official page when touching a native API, modifier, platform file, module, or design behavior.
4. Preserve the distinction between vendor guidance and Kyomi product rules:
   - platform docs own native semantics;
   - Kyomi owns routes, domain structure, public package boundaries, tokens, and shared presentation ownership.

**Acceptance:** a web or mobile agent can identify the right official documentation source from its owner skill without a project-wide documentation registry.

## Task 3: Add the minimal project-local Pi extension

**Files:**

- `.gitignore`
- `.pi/extensions/kyomi.ts` (new)

1. Replace the duplicate broad `.pi/` ignore rules with narrow ignore rules that keep runtime task output ignored while allowing `.pi/extensions/kyomi.ts` to be tracked.
2. Implement a dependency-free extension using Pi’s public `ExtensionAPI`.
3. Register `before_agent_start` guidance that concisely restates the framework:
   - load relevant Kyomi skills and inspect local context;
   - fetch version-matched first-party docs for framework/native work;
   - reuse an existing owner/seam before creating a file, directory, export, package, or abstraction;
   - preserve kebab-case authored names and framework-mandated names; and
   - run affected checks and report evidence.
4. Register a `tool_call` handler that protects **direct** `edit` and `write` calls only. Block normalized paths that are unambiguously inappropriate to hand-edit:
   - actual secret environment files, while allowing committed examples;
   - `.git/` and `node_modules/`;
   - build, output, cache, coverage, virtual-environment, and native build directories;
   - `apps/web/src/routeTree.gen.ts` and any other documented never-hand-edit generated artifact.
5. Use a clear block reason that names the protected category and the appropriate generator/configuration path where one exists.
6. Do not:
   - override Pi’s built-in tools;
   - parse arbitrary shell commands;
   - add stateful skill-completion tracking;
   - call model APIs, register background review tools, or add a package/config framework; or
   - load/run the extension in CI.

**Acceptance:** developers who trust the checkout can load a tracked extension that improves the default implementation workflow and blocks only obvious direct-write mistakes.

## Task 4: Extend the existing boundary checker, not the quality surface

**Files:** `scripts/check-boundaries.ts`

1. Add `packages/db/src` and `packages/reader/src` to `SOURCE_ROOTS`.
2. Preserve the checker’s current documented invariants:
   - packages do not import app internals;
   - package consumers do not deep-import `@kyomi/*/src/*`;
   - worker code does not import API/HTTP module internals.
3. Add a new rule only when it maps to an existing documented invariant and has a deterministic failure case.
4. Do not duplicate Oxlint’s naming, depth, complexity, or maximum-line checks here.
5. Keep the existing `check:boundaries` command and `ci:static` integration. Do not add `scripts/quality`, a second wrapper command, or another CI job.

**Acceptance:** all relevant shared package source roots receive the same import-boundary coverage with no duplicate quality framework.

## Task 5: Add proportional regression coverage

**Files:** `tests/api/integration/scripts/check-boundaries.test.ts` (new, if the current Bun test harness can execute it without a new runner)

1. Create a temporary fixture project in the test, execute the existing boundary checker with the fixture as its working directory, and assert:
   - a package importing app internals fails;
   - an `@kyomi/*/src/*` deep import fails;
   - a valid public-package import passes.
2. Include `packages/db/src` and `packages/reader/src` in fixture coverage so the new roots cannot be removed silently.
3. Do not create a mobile test runner or test generated documentation content.
4. Do not add a CI-only Pi runtime harness. Pi is developer tooling outside the Bun workspace dependency graph; validate its load behavior manually against the installed Pi version.

**Acceptance:** deterministic checker behavior has a focused regression test, and the plan does not add a new cross-platform test framework merely to test a local Pi extension.

## Task 6: Validate the extension and documentation workflow manually

1. From a trusted checkout, start Pi with project trust enabled and reload project resources.
2. Use a disposable source file to confirm a valid direct edit/write is allowed.
3. Attempt direct writes to one secret env file, one ignored build output, and `routeTree.gen.ts`; confirm each is blocked with a useful reason.
4. Run one small web framework change and one small mobile native/framework change in a review-only exercise. Confirm the agent can produce the documentation evidence block with:
   - installed version/type evidence;
   - official source URLs;
   - the precise applied rule; and
   - an explicit divergence when Kyomi intentionally differs from an example.
5. Confirm no source-document snapshot, vendor code dump, arbitrary adapter, or unrequested dependency was added.

**Acceptance:** the process is usable in the real agent environment, not only described in a prompt.

## Task 7: Run deterministic quality gates and preserve review order

Run the smallest relevant checks first, then the framework-wide checks:

```sh
bun run check:boundaries
bun run fmt:check
bun run lint
bun run typecheck:app
bun run test
bun run ci:static
```

For Task 5, run the focused API integration test before the broad suite. If a broad command fails in an unrelated dirty-workspace or environment area, report the exact blocker and preserve the focused evidence.

After deterministic checks pass, optionally run a fresh Pi session with read-only tools to review the changed files for:

- unnecessary new files/directories or duplicate helpers;
- violations of the selected owner skill;
- documentation/version mismatches;
- package export and import-boundary mistakes; and
- missing affected-scope verification.

Do not make that model review a required GitHub Actions job.

## Completion criteria

- A substantial implementation task has one explicit feature-start context workflow.
- Web and mobile owner skills identify their official, version-aware documentation sources.
- The framework distinguishes installed APIs, official guidance, platform conventions, and Kyomi architecture instead of treating any one as universal.
- `.pi/extensions/kyomi.ts` is tracked, has no dependency, and blocks only direct unsafe writes.
- The existing boundary checker covers all relevant shared TypeScript package roots.
- Existing quality commands and CI remain the deterministic merge gates.
- At least one real web and mobile documentation-evidence exercise validates that the process produces actionable context rather than generic citations.
- No broad documentation mirror, generic quality framework, Coss adoption, automatic model review, or unrequested dependency is introduced.

## Deferred follow-ups

- Promote selected Oxlint warnings to errors only after an intentional repository-wide baseline cleanup.
- Add a model-powered review command only if the deterministic workflow leaves a demonstrated gap.
- Add a stricter new-file naming guard only after collecting false-positive data from the existing filename lint rule and framework-mandated route/platform names.
- Revisit the source maps on Expo SDK, TanStack major/minor, Uniwind, Coss, or platform-design-system upgrades.

## Reference sources

- [TanStack Start](https://tanstack.com/start/latest/docs/framework/react/overview)
- [TanStack Router](https://tanstack.com/router/latest/docs/framework/react/overview)
- [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview)
- [Expo UI](https://docs.expo.dev/versions/v57.0.0/sdk/ui/)
- [Uniwind](https://docs.uniwind.dev/)
- [Coss UI](https://coss.com/ui/docs)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)
- [Jetpack Compose design systems](https://developer.android.com/develop/ui/compose/designsystems)

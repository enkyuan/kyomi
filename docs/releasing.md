# Releasing Kyomi

Kyomi uses one repository release version for a snapshot of the complete product. Git tags use
`vMAJOR.MINOR.PATCH`, for example `v0.1.0-alpha.1`. The version on a GitHub release identifies
the tagged commit; existing private workspace package versions have their own histories and are not
the release source of truth.

## Version selection

Follow [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html). Initial development uses
`0.y.z`. Start with `0.1.0-alpha.1`; increment the prerelease number for another snapshot in
the same series. Choose a new minor version for significant new capability or incompatible changes,
and a patch for fixes within the current minor series. Use `alpha`, `beta`, or `rc` to describe
the release stage. A stable `v1.0.0` marks the start of a stable public compatibility contract.

A published version and its tag are immutable. Fixes after publication receive a new version. Do
not move an existing tag or replace its contents.

## Release cadence

During alpha, a pull request containing meaningful product changes can have its own prerelease.
A prerelease may tag the exact PR head before merge or a commit on the default branch after merge.
Identify the PR, commit, and whether it has merged in the release notes. A later update to the PR
requires a new prerelease version. Concurrent PRs may contain different changes, so do not assume
that one prerelease contains all earlier prereleases.

In beta, group changes into builds for broader testing as they are ready, and publish fixes when
testers need them. Use release candidates to validate a specific proposed stable release. Once
stable releases begin, publish new versions for ready changes and fixes, using the compatibility
rules of SemVer and the project's actual release and support needs.

## Release process

1. Fetch the remote default branch, relevant PR head, and tags. Check for an existing release and
   tag before choosing the next version. Identify the exact commit to release and whether it is a
   PR head or on the default branch. A PR-head release includes that commit's ancestry and is not
   evidence that its changes have merged.
2. Review changes included in the selected commit. Compare with a prior tag only when it is an
   ancestor of the selected commit. For a PR-head release, describe the PR and its base, then check
   the generated notes against the commit. Verify relevant checks for the exact commit and report
   any missing checks or known limitations.
3. Name the GitHub release after its tag, such as `v0.1.0-alpha.1`. Generate notes using
   GitHub's release notes API or `gh release create --generate-notes`, then review them against
   the tagged history. Use the generated **What's Changed**, **New Contributors** when applicable,
   and **Full Changelog** sections with contributor and pull request links. Add migration or
   operational steps where needed, and distinguish local tests from CI.
4. Create a signed annotated tag on the chosen commit using `git tag -s vX.Y.Z-... -m '...'`.
   Push the tag, then create a GitHub release with `gh release create` and `--prerelease` for
   prerelease versions. Do not attach binaries unless they were built and verified for that release.
5. Verify the remote tag, release target, prerelease flag, notes, and GitHub signature status.
   If publishing fails, inspect remote state before retrying. Never overwrite a published tag.

A GitHub release records source history. Deployment, app-store publication, migrations, and package
publication are separate operations and require their own verification.

All coding agents should follow this guide when preparing, tagging, or publishing releases.

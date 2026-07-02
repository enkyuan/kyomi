#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DRIZZLE_PATH="packages/db/drizzle"

section() {
  printf "\n==> %s\n" "$1"
}

fail() {
  printf "ERROR: %s\n" "$1" >&2
  exit 1
}

section "Checking Drizzle migration drift"

if ! git -C "$ROOT_DIR" diff --quiet -- "$DRIZZLE_PATH"; then
  fail "Drizzle migration files already have unstaged changes. Commit or stash them before running the drift check."
fi

if ! git -C "$ROOT_DIR" diff --cached --quiet -- "$DRIZZLE_PATH"; then
  fail "Drizzle migration files already have staged changes. Commit or unstage them before running the drift check."
fi

section "Regenerating migrations"
(
  cd "$ROOT_DIR"
  bun run --cwd packages/db db:generate
)

section "Inspecting generated diff"
if git -C "$ROOT_DIR" diff --quiet -- "$DRIZZLE_PATH"; then
  printf "Drizzle migrations are up to date.\n"
  exit 0
fi

git -C "$ROOT_DIR" --no-pager diff -- "$DRIZZLE_PATH"
fail "Drizzle generated migration changes. Run 'bun run db:generate' locally and commit the resulting migration files."

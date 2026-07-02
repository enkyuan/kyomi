#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

section() {
  printf "\n==> %s\n" "$1"
}

fail() {
  printf "ERROR: %s\n" "$1" >&2
  exit 1
}

copy_env() {
  local example_path="$1"
  local target_path="$2"

  [[ -f "$example_path" ]] || fail "Missing checked-in env example: $example_path"

  if [[ "${CI:-}" == "true" || "${KYOMI_FORCE_PREPARE_ENV:-}" == "1" ]]; then
    cp "$example_path" "$target_path"
    printf "Reset %s from %s\n" "${target_path#$ROOT_DIR/}" "${example_path#$ROOT_DIR/}"
    return
  fi

  if [[ -f "$target_path" ]]; then
    printf "Using existing %s\n" "${target_path#$ROOT_DIR/}"
    return
  fi

  cp "$example_path" "$target_path"
  printf "Created %s from %s\n" "${target_path#$ROOT_DIR/}" "${example_path#$ROOT_DIR/}"
}

ensure_env_value() {
  local target_path="$1"
  local key="$2"
  local value="$3"
  local existed_before="$4"

  if [[ "${CI:-}" != "true" && "${KYOMI_FORCE_PREPARE_ENV:-}" != "1" && "$existed_before" == "1" ]]; then
    if ! grep -q "^${key}=" "$target_path"; then
      printf "Missing %s in existing %s; leaving local env untouched. Set KYOMI_FORCE_PREPARE_ENV=1 to write defaults.\n" "$key" "${target_path#$ROOT_DIR/}"
    fi
    return
  fi

  if grep -q "^${key}=" "$target_path"; then
    return
  fi

  printf "%s=%s\n" "$key" "$value" >> "$target_path"
  printf "Set %s in %s\n" "$key" "${target_path#$ROOT_DIR/}"
}

api_env_existed=0
web_env_existed=0
[[ -f "$ROOT_DIR/apps/api/.env" ]] && api_env_existed=1
[[ -f "$ROOT_DIR/apps/web/.env" ]] && web_env_existed=1

section "Preparing CI env files"
copy_env "$ROOT_DIR/docker/.env.example" "$ROOT_DIR/docker/.env"
copy_env "$ROOT_DIR/apps/api/.env.example" "$ROOT_DIR/apps/api/.env"
copy_env "$ROOT_DIR/apps/web/.env.example" "$ROOT_DIR/apps/web/.env"

section "Ensuring required app defaults"
ensure_env_value "$ROOT_DIR/apps/api/.env" "BETTER_AUTH_URL" "http://localhost:3000" "$api_env_existed"
ensure_env_value "$ROOT_DIR/apps/api/.env" "BETTER_AUTH_TRUSTED_ORIGINS" "http://localhost:3000" "$api_env_existed"
ensure_env_value "$ROOT_DIR/apps/api/.env" "MEILI_URL" "http://localhost:7700" "$api_env_existed"
ensure_env_value "$ROOT_DIR/apps/api/.env" "MEILI_MASTER_KEY" "vols-meili-dev-key" "$api_env_existed"
ensure_env_value "$ROOT_DIR/apps/api/.env" "MEILI_INDEX_FEEDS" "feeds" "$api_env_existed"
ensure_env_value "$ROOT_DIR/apps/api/.env" "SKIP_ENV_VALIDATION" "true" "$api_env_existed"
ensure_env_value "$ROOT_DIR/apps/web/.env" "SERVER_URL" "http://localhost:3000" "$web_env_existed"
ensure_env_value "$ROOT_DIR/apps/web/.env" "API_ORIGIN" "http://localhost:8000" "$web_env_existed"

section "Environment ready"

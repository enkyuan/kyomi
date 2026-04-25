#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
LOCK_DIR="${ROOT_DIR}/.catalog-sync.lock"
LOG_DIR="${ROOT_DIR}/.catalog-sync-logs"
LOG_FILE="${LOG_DIR}/catalog-sync-$(date +%F).log"

mkdir -p "${LOG_DIR}"

if ! command -v bun >/dev/null 2>&1; then
  echo "[catalog-sync] bun is required but not found in PATH" >>"${LOG_FILE}"
  exit 1
fi

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  echo "[catalog-sync] skipped: another sync is already running" >>"${LOG_FILE}"
  exit 0
fi

cleanup() {
  rmdir "${LOCK_DIR}" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

{
  echo "[catalog-sync] started at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "[catalog-sync] root=${ROOT_DIR}"
  cd "${ROOT_DIR}"
  bun run catalog:sync
  echo "[catalog-sync] finished at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} >>"${LOG_FILE}" 2>&1

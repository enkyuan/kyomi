#!/usr/bin/env bash
# Free root disk and move containerd storage to /home (Docker data-root is already there).
# Run: sudo ./docker/fix-docker-disk.sh
set -euo pipefail

if [[ "${EUID:-}" -ne 0 ]]; then
  echo "Run with sudo: sudo $0" >&2
  exit 1
fi

CONTAINERD_ROOT="/home/enkyuan/containerd"
DOCKER_DATA="/home/enkyuan/docker-data"
CONTAINERD_CONF="/etc/containerd/config.toml"

echo "==> Disk before"
df -h / /home

echo "==> Clear pacman package cache (often ~20GB on /)"
pacman -Scc --noconfirm

echo "==> Stop Docker and containerd"
systemctl stop docker containerd 2>/dev/null || true

echo "==> Point containerd root at ${CONTAINERD_ROOT}"
mkdir -p "${CONTAINERD_ROOT}"
chown root:root "${CONTAINERD_ROOT}"

if [[ -f "${CONTAINERD_CONF}" ]]; then
  if grep -q "^root = '/var/lib/containerd'" "${CONTAINERD_CONF}"; then
    sed -i "s|^root = '/var/lib/containerd'|root = '${CONTAINERD_ROOT}'|" "${CONTAINERD_CONF}"
  elif ! grep -q "^root = '${CONTAINERD_ROOT}'" "${CONTAINERD_CONF}"; then
    echo "WARN: Edit ${CONTAINERD_CONF} manually — set root = '${CONTAINERD_ROOT}'" >&2
  fi
fi

if [[ -d /var/lib/containerd ]] && [[ "$(ls -A /var/lib/containerd 2>/dev/null || true)" ]]; then
  echo "==> Migrate existing containerd data"
  rsync -aHAX /var/lib/containerd/ "${CONTAINERD_ROOT}/"
  rm -rf /var/lib/containerd/*
fi

mkdir -p "${DOCKER_DATA}"
if ! grep -q '"data-root"' /etc/docker/daemon.json 2>/dev/null; then
  echo "WARN: Ensure /etc/docker/daemon.json sets data-root to ${DOCKER_DATA}" >&2
fi

echo "==> Prune unused Docker objects"
docker system prune -f

echo "==> Start containerd and Docker"
systemctl start containerd
systemctl start docker

echo "==> Disk after"
df -h / /home

echo "==> Pull compose images (run from repo root as your user):"
echo "    bun run docker:pull"

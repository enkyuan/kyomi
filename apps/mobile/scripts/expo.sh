#!/bin/sh
set -eu

# Run expo with Metro advertised on this Mac's Tailscale MagicDNS name when Tailscale is up. The
# name is stable and reachable from a phone on any network, including ones that isolate Wi-Fi
# clients. iOS App Transport Security only allows plain HTTP to it through the ts.net exception in
# Info.plist, so the name is preferred over the bare 100.x address. The app reuses Metro's host
# for the API, so nothing else needs configuring.
# Set REACT_NATIVE_PACKAGER_HOSTNAME to override; without Tailscale Expo picks the LAN address.
if [ -z "${REACT_NATIVE_PACKAGER_HOSTNAME:-}" ]; then
  cli=""
  if command -v tailscale >/dev/null 2>&1; then
    cli=tailscale
  elif [ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]; then
    cli=/Applications/Tailscale.app/Contents/MacOS/Tailscale
  fi

  host=""
  if [ -n "$cli" ]; then
    # The first DNSName in `status --json` is this machine. A stopped CLI prints an error on
    # stdout instead, so accept only a ts.net name.
    host=$("$cli" status --json 2>/dev/null | sed -n 's/.*"DNSName": *"\([^"]*\)".*/\1/p' | head -n 1 | sed 's/\.$//' | grep -E '^[A-Za-z0-9.-]+\.ts\.net$' || true)
  fi

  if [ -n "$host" ]; then
    export REACT_NATIVE_PACKAGER_HOSTNAME="$host"
    echo "Using Tailscale host $host for Metro and the API." >&2
  else
    echo "Tailscale is not running or MagicDNS is off; using the LAN address. Start Tailscale on the Mac and iPhone if the phone cannot connect." >&2
  fi
fi

exec expo "$@"

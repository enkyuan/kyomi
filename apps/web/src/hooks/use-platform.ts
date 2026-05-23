"use client";

import { useMemo, useSyncExternalStore } from "react";

export type ClientPlatform = "mac" | "windows" | "linux" | "other";

/** Unicode symbols shown in shortcut hints (not the literal key names). */
const MODIFIER_KEY_SYMBOL = {
  meta: "\u2318",
  ctrl: "\u2303",
} as const;

export type PlatformState = {
  platform: ClientPlatform;
  isMac: boolean;
  isWindows: boolean;
  isLinux: boolean;
  /** Display symbol for the primary command modifier (⌘ or ⌃). */
  modifierKeyLabel: string;
  /** macOS/iOS use Meta; Windows and Linux use Ctrl. */
  usesMetaModifier: boolean;
};

function subscribePlatform() {
  return () => {};
}

function getServerPlatform(): ClientPlatform {
  return "other";
}

function detectClientPlatform(): ClientPlatform {
  if (typeof navigator === "undefined") {
    return "other";
  }

  const { platform, userAgent } = navigator;

  if (/Mac|iPhone|iPad|iPod/.test(platform) || /Mac OS X/.test(userAgent)) {
    return "mac";
  }
  if (/Win/.test(platform) || /Windows/.test(userAgent)) {
    return "windows";
  }
  if (/Linux/.test(platform) || /Linux/.test(userAgent)) {
    return "linux";
  }

  return "other";
}

function platformStateFromClient(platform: ClientPlatform): PlatformState {
  const isMac = platform === "mac";
  const isWindows = platform === "windows";
  const isLinux = platform === "linux";
  const usesMetaModifier = isMac;

  return {
    platform,
    isMac,
    isWindows,
    isLinux,
    modifierKeyLabel: usesMetaModifier ? MODIFIER_KEY_SYMBOL.meta : MODIFIER_KEY_SYMBOL.ctrl,
    usesMetaModifier,
  };
}

/** Whether a keydown event used the OS-appropriate primary command modifier. */
export function isPlatformModifierShortcut(
  event: Pick<KeyboardEvent, "metaKey" | "ctrlKey">,
  platform: Pick<PlatformState, "usesMetaModifier">,
): boolean {
  return platform.usesMetaModifier
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
}

export function usePlatform(): PlatformState {
  const platform = useSyncExternalStore(subscribePlatform, detectClientPlatform, getServerPlatform);

  return useMemo(() => platformStateFromClient(platform), [platform]);
}

import type { SessionDevice } from "./types";

function detectBrowser(userAgent: string) {
  if (/Firefox\//i.test(userAgent)) return "Firefox";
  if (/Edg\//i.test(userAgent)) return "Edge";
  if (/Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent)) return "Chrome";
  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return "Safari";
  return "Browser";
}

function detectOs(userAgent: string) {
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Android/i.test(userAgent)) return "Android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iPhone";
  if (/Mac OS X|Macintosh/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "Unknown OS";
}

export function describeSessionDevice(userAgent: string | null): SessionDevice {
  if (!userAgent) {
    return {
      fullUserAgent: "Unknown user agent",
      label: "Unknown device",
      meta: "No device details available",
    };
  }

  const normalized = userAgent.trim();
  if (!normalized) {
    return {
      fullUserAgent: "Unknown user agent",
      label: "Unknown device",
      meta: "No device details available",
    };
  }

  const browser = detectBrowser(normalized);
  const os = detectOs(normalized);

  return {
    fullUserAgent: normalized,
    label: `${browser} on ${os}`,
    meta: normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized,
  };
}

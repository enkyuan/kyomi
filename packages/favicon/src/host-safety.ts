import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

export const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

const blockedAddressList = new BlockList();
blockedAddressList.addSubnet("0.0.0.0", 8, "ipv4");
blockedAddressList.addSubnet("10.0.0.0", 8, "ipv4");
blockedAddressList.addSubnet("100.64.0.0", 10, "ipv4");
blockedAddressList.addSubnet("127.0.0.0", 8, "ipv4");
blockedAddressList.addSubnet("169.254.0.0", 16, "ipv4");
blockedAddressList.addSubnet("172.16.0.0", 12, "ipv4");
blockedAddressList.addSubnet("192.168.0.0", 16, "ipv4");
blockedAddressList.addSubnet("::", 128, "ipv6");
blockedAddressList.addSubnet("::1", 128, "ipv6");
blockedAddressList.addSubnet("fc00::", 7, "ipv6");
blockedAddressList.addSubnet("fe80::", 10, "ipv6");

const blockedExactHostnames = new Set(["localhost", "metadata.google.internal"]);
const blockedHostnameSuffixes = [".localhost", ".local", ".internal", ".home.arpa"];

export function canonicalHostname(hostname: string): string {
  const withoutBrackets =
    hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  return withoutBrackets.toLowerCase().replace(/\.+$/, "");
}

function isBlockedHostname(hostname: string): boolean {
  return (
    blockedExactHostnames.has(hostname) ||
    blockedHostnameSuffixes.some((suffix) => hostname.endsWith(suffix))
  );
}

function normalizeIpAddress(address: string): string {
  const normalized = canonicalHostname(address);
  const mappedIpv4Prefix = "::ffff:";
  if (!normalized.startsWith(mappedIpv4Prefix)) {
    return normalized;
  }
  const mappedIpv4 = normalized.slice(mappedIpv4Prefix.length);
  return isIP(mappedIpv4) === 4 ? mappedIpv4 : normalized;
}

function isBlockedIpAddress(address: string): boolean {
  const normalized = normalizeIpAddress(address);
  const family = isIP(normalized);
  if (family === 0) {
    return false;
  }
  return blockedAddressList.check(normalized, family === 6 ? "ipv6" : "ipv4");
}

/** Returns whether DNS resolution for this hostname yields only non-blocked addresses. */
export async function assertSafeFaviconHost(hostname: string): Promise<boolean> {
  const canonical = canonicalHostname(hostname);
  if (!canonical || isBlockedHostname(canonical)) {
    return false;
  }

  let addresses: string[];
  if (isIP(canonical) !== 0) {
    addresses = [canonical];
  } else {
    try {
      const lookupPromise = lookup(canonical, { all: true, verbatim: true });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DNS timeout")), 1500),
      );
      const resolved = (await Promise.race([lookupPromise, timeoutPromise])) as {
        address: string;
      }[];
      addresses = [...new Set(resolved.map((r) => normalizeIpAddress(r.address)))];
    } catch {
      return false;
    }
  }

  return !addresses.some((addr) => isBlockedIpAddress(addr));
}

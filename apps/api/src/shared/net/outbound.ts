import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const blockedAddressList = new BlockList();
const sharedAddressList = new BlockList();

blockedAddressList.addSubnet("0.0.0.0", 8, "ipv4");
blockedAddressList.addSubnet("10.0.0.0", 8, "ipv4");
blockedAddressList.addSubnet("127.0.0.0", 8, "ipv4");
blockedAddressList.addSubnet("169.254.0.0", 16, "ipv4");
blockedAddressList.addSubnet("172.16.0.0", 12, "ipv4");
blockedAddressList.addSubnet("192.168.0.0", 16, "ipv4");
sharedAddressList.addSubnet("100.64.0.0", 10, "ipv4");

blockedAddressList.addSubnet("::", 128, "ipv6");
blockedAddressList.addSubnet("::1", 128, "ipv6");
blockedAddressList.addSubnet("fc00::", 7, "ipv6");
blockedAddressList.addSubnet("fe80::", 10, "ipv6");

const blockedExactHostnames = new Set(["localhost", "metadata.google.internal"]);
const blockedHostnameSuffixes = [".localhost", ".local", ".internal", ".home.arpa"];

export class BlockedOutboundUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedOutboundUrlError";
  }
}

function canonicalHostname(hostname: string): string {
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

export function isBlockedOutboundIpAddress(
  address: string,
  options: { blockSharedAddressSpace?: boolean } = {},
): boolean {
  const normalized = normalizeIpAddress(address);
  const family = isIP(normalized);
  if (family === 0) {
    return false;
  }
  const familyName = family === 6 ? "ipv6" : "ipv4";
  return (
    blockedAddressList.check(normalized, familyName) ||
    (options.blockSharedAddressSpace === true && sharedAddressList.check(normalized, familyName))
  );
}

async function resolveHostnameAddresses(hostname: string): Promise<string[]> {
  if (isIP(hostname) !== 0) {
    return [hostname];
  }

  const resolved = await lookup(hostname, { all: true, verbatim: true });
  return [...new Set(resolved.map((record) => normalizeIpAddress(record.address)))];
}

export async function assertSafeOutboundUrl(url: URL): Promise<void> {
  const hostname = canonicalHostname(url.hostname);
  if (!hostname) {
    throw new BlockedOutboundUrlError("URL must include a hostname");
  }

  if (isBlockedHostname(hostname)) {
    throw new BlockedOutboundUrlError("Private network URLs are not allowed");
  }

  const isLiteralIpAddress = isIP(hostname) !== 0;
  const resolvedAddresses = await resolveHostnameAddresses(hostname);
  if (
    resolvedAddresses.some((address) =>
      isBlockedOutboundIpAddress(address, {
        blockSharedAddressSpace: isLiteralIpAddress,
      }),
    )
  ) {
    throw new BlockedOutboundUrlError("Private network URLs are not allowed");
  }
}

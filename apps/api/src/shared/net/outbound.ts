import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { Context, Data, Effect } from "effect";
import { UpstreamError } from "@shared/effect/errors";

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

/** The target (or a redirect hop) is not a public http(s) URL. */
export class UnsafeOutboundUrl extends Data.TaggedError("UnsafeOutboundUrl")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

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

/**
 * How a hostname becomes addresses. The default asks the system resolver; tests provide a fixed
 * answer with `Effect.provideService(HostResolver, ...)` instead of needing real DNS.
 */
export const HostResolver = Context.Reference<
  (hostname: string) => Effect.Effect<readonly string[], UpstreamError>
>("kyomi/HostResolver", {
  defaultValue: () => (hostname) =>
    Effect.tryPromise({
      try: async () => {
        const records = await lookup(hostname, { all: true, verbatim: true });
        return records.map((record) => record.address);
      },
      catch: (cause) => new UpstreamError({ operation: "resolve outbound host", cause }),
    }),
});

const PRIVATE_NETWORK_MESSAGE = "Private network URLs are not allowed";

/**
 * Fails with `UnsafeOutboundUrl` unless `url` is a public destination: a literal address or every
 * address its hostname resolves to must be outside the private, loopback and link-local ranges.
 * A resolver failure is an `UpstreamError`.
 */
export const checkOutboundUrl = Effect.fn("net.checkOutboundUrl")(function* (url: URL) {
  const hostname = canonicalHostname(url.hostname);
  if (!hostname) {
    return yield* new UnsafeOutboundUrl({
      message: "URL must include a hostname",
      cause: new BlockedOutboundUrlError("URL must include a hostname"),
    });
  }
  const blocked = () =>
    new UnsafeOutboundUrl({
      message: PRIVATE_NETWORK_MESSAGE,
      cause: new BlockedOutboundUrlError(PRIVATE_NETWORK_MESSAGE),
    });
  if (isBlockedHostname(hostname)) {
    return yield* blocked();
  }

  const isLiteralIpAddress = isIP(hostname) !== 0;
  const resolve = yield* HostResolver;
  const addresses = isLiteralIpAddress ? [hostname] : yield* resolve(hostname);
  const resolved = new Set(addresses.map(normalizeIpAddress));
  for (const address of resolved) {
    if (isBlockedOutboundIpAddress(address, { blockSharedAddressSpace: isLiteralIpAddress })) {
      return yield* blocked();
    }
  }
});

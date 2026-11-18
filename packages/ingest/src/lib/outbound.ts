import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

/**
 * The one outbound policy for a URL somebody else chose (a feed, a favicon, an image). Destination
 * rules: http(s) only, no private, loopback, link-local, multicast, reserved or documentation
 * address, and no name that only means something inside a network. `fetchPublic` applies them to
 * every hop of a redirect chain and then connects to an address it checked, so a name that answers
 * differently the second time (DNS rebinding) cannot move the request.
 */

export const ALLOWED_SCHEMES: ReadonlySet<string> = new Set(["http:", "https:"]);

const blocked = new BlockList();
const sharedAddressSpace = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, including cloud metadata
  ["172.16.0.0", 12],
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relay
  ["192.168.0.0", 16],
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, and the broadcast address
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
sharedAddressSpace.addSubnet("100.64.0.0", 10, "ipv4"); // carrier-grade NAT

for (const [network, prefix] of [
  ["::", 96], // unspecified, loopback and the deprecated IPv4-compatible range (::a.b.c.d)
  ["::ffff:0:0:0", 96], // IPv4-translated (SIIT)
  ["64:ff9b::", 96], // NAT64: an IPv4 address in disguise
  ["64:ff9b:1::", 48],
  ["100::", 64], // discard-only
  ["2001::", 32], // Teredo
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4: an IPv4 address in disguise
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["fec0::", 10], // site-local, deprecated
  ["ff00::", 8], // multicast
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);
const BLOCKED_HOSTNAME_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"];

export function canonicalHostname(hostname: string): string {
  const unbracketed =
    hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  return unbracketed.toLowerCase().replace(/\.+$/, "");
}

/** An IPv4-mapped IPv6 address (`::ffff:127.0.0.1`) is the IPv4 address it wraps. */
export function normalizeIpAddress(address: string): string {
  const normalized = canonicalHostname(address);
  if (!normalized.startsWith("::ffff:")) {
    return normalized;
  }
  const wrapped = normalized.slice("::ffff:".length);
  return isIP(wrapped) === 4 ? wrapped : normalized;
}

/**
 * Whether `hostname` names a place that is only reachable from inside a network, judged by its
 * text alone: `localhost`, the cloud metadata name, the private suffixes, and a name with no dot
 * (`redis`, `postgres`), which only a private resolver answers.
 */
export function isBlockedOutboundHostname(hostname: string): boolean {
  const name = canonicalHostname(hostname);
  if (!name || BLOCKED_HOSTNAMES.has(name)) {
    return true;
  }
  if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => name.endsWith(suffix))) {
    return true;
  }
  return isIP(name) === 0 && !name.includes(".");
}

/**
 * Whether `address` must not be connected to. Shared address space (100.64.0.0/10) is only
 * refused when `blockSharedAddressSpace` is set; `fetchPublic` always sets it.
 */
export function isBlockedOutboundIpAddress(
  address: string,
  options: { blockSharedAddressSpace?: boolean } = {},
): boolean {
  const normalized = normalizeIpAddress(address);
  const family = isIP(normalized);
  if (family === 0) {
    return false;
  }
  const name = family === 6 ? "ipv6" : "ipv4";
  return (
    blocked.check(normalized, name) ||
    (options.blockSharedAddressSpace === true && sharedAddressSpace.check(normalized, name))
  );
}

/** How a name becomes addresses. Tests give `fetchPublic` a fixed answer instead of real DNS. */
export type ResolveAddresses = (hostname: string) => Promise<readonly string[]>;

const DNS_TIMEOUT_MS = 1_500;

export const resolveAddresses: ResolveAddresses = async (hostname) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const records = await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("DNS timeout")), DNS_TIMEOUT_MS);
      }),
    ]);
    return records.map((record) => record.address);
  } finally {
    clearTimeout(timer);
  }
};

/** The destination is not a public http(s) URL. */
export class BlockedOutboundUrl extends Error {
  constructor(message = "Private network URLs are not allowed") {
    super(message);
    this.name = "BlockedOutboundUrl";
  }
}

/**
 * The addresses to connect to for `url`, every one checked: none for a literal IP (it is its own
 * address), and `BlockedOutboundUrl` when the scheme, the name or any resolved address is not
 * allowed. A resolver failure is passed on as it is.
 */
export async function checkPublicUrl(
  url: URL,
  resolve: ResolveAddresses = resolveAddresses,
): Promise<string[]> {
  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    throw new BlockedOutboundUrl("Only http and https URLs are allowed");
  }
  const hostname = canonicalHostname(url.hostname);
  if (isBlockedOutboundHostname(hostname)) {
    throw new BlockedOutboundUrl();
  }
  const literal = isIP(hostname) !== 0;
  const addresses = literal ? [hostname] : await resolve(hostname);
  if (addresses.length === 0) {
    throw new Error(`No address for ${hostname}`);
  }
  // A resolver answer that is not an address (`127.1`, a name) would be read as one by `fetch`.
  if (addresses.some((address) => isIP(normalizeIpAddress(address)) === 0)) {
    throw new BlockedOutboundUrl();
  }
  if (
    addresses.some((address) =>
      isBlockedOutboundIpAddress(address, { blockSharedAddressSpace: true }),
    )
  ) {
    throw new BlockedOutboundUrl();
  }
  return literal ? [] : addresses.map(normalizeIpAddress);
}

/** Whether `url` passes `checkPublicUrl`; a name that cannot be resolved does not. */
export async function isPublicUrl(
  url: URL,
  resolve: ResolveAddresses = resolveAddresses,
): Promise<boolean> {
  try {
    await checkPublicUrl(url, resolve);
    return true;
  } catch {
    return false;
  }
}

/** The call shape of `fetch`, without the runtime's extra members. */
export type PinnedFetch = (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>;

/**
 * A `fetch` that connects to `address` however the URL's host would resolve, while still speaking
 * to that host: the request carries its `Host` header, and for https the TLS server name, so the
 * certificate is checked against the host and not the address. Bun's `fetch` speaks HTTP/1.1,
 * where `Host` is what selects the site; `pinned-fetch.test.ts` pins that against a real TLS
 * server.
 */
export function pinnedFetch(address: string): PinnedFetch {
  return (input, init) => {
    const original = new URL(input instanceof Request ? input.url : String(input));
    const target = new URL(original);
    target.hostname = address.includes(":") ? `[${address}]` : address;
    const headers = new Headers(init?.headers);
    headers.set("host", original.host);
    const tls = (init as { tls?: object } | undefined)?.tls;
    return globalThis.fetch(target, {
      ...init,
      headers,
      ...(original.protocol === "https:" ? { tls: { ...tls, serverName: original.hostname } } : {}),
    } as RequestInit);
  };
}

const isRedirect = (status: number) => [301, 302, 303, 307, 308].includes(status);

/** IPv4 first: a server with no IPv6 route would otherwise fail on an address it cannot reach. */
const ipv4First = (addresses: readonly string[]) =>
  [...addresses].sort((a, b) => Number(a.includes(":")) - Number(b.includes(":")));

/** GET `url` at each checked address in turn; a failure on the last one is the failure. */
async function requestChecked(
  url: URL,
  init: RequestInit,
  addresses: readonly string[],
): Promise<Response> {
  if (addresses.length === 0) {
    return globalThis.fetch(url, init);
  }
  const candidates = ipv4First(addresses);
  let failure: unknown;
  for (const address of candidates) {
    try {
      return await pinnedFetch(address)(url, init);
    } catch (error) {
      failure = error;
    }
  }
  throw failure;
}

/**
 * GET a URL somebody else chose. Redirects are followed by hand, up to `maxRedirects`, and every
 * hop (the first URL and each `Location`) goes through `checkPublicUrl` before it is requested.
 * Throws `BlockedOutboundUrl` for a destination that is not allowed and `Error("Too many
 * redirects")` past the limit; the caller sets the timeout with `init.signal`.
 */
export async function fetchPublic(
  rawUrl: string,
  init: Omit<RequestInit, "redirect">,
  options: { maxRedirects?: number; resolve?: ResolveAddresses } = {},
): Promise<{ response: Response; finalUrl: string }> {
  const maxRedirects = options.maxRedirects ?? 5;
  let url = new URL(rawUrl);
  for (let redirects = 0; ; redirects += 1) {
    const addresses = await checkPublicUrl(url, options.resolve);
    const response = await requestChecked(url, { ...init, redirect: "manual" }, addresses);
    const location = response.headers.get("location");
    if (!isRedirect(response.status) || !location) {
      return { response, finalUrl: url.href };
    }
    response.body?.cancel().catch(() => undefined);
    if (redirects === maxRedirects) {
      throw new Error("Too many redirects");
    }
    url = new URL(location, url);
  }
}

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Context, Data, Effect } from "effect";
import {
  canonicalHostname,
  isBlockedOutboundHostname,
  isBlockedOutboundIpAddress,
  normalizeIpAddress,
} from "@kyomi/ingest/lib/outbound";
import { UpstreamError } from "@shared/effect/errors";

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

export { isBlockedOutboundIpAddress };

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
 * A resolver failure is an `UpstreamError`. Succeeds with the addresses that were checked, which a
 * caller connects to (see `pinnedFetch`) instead of resolving the name again; none for a literal
 * address, which needs no resolving.
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
  if (isBlockedOutboundHostname(hostname)) {
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
  return isLiteralIpAddress ? [] : [...resolved];
});

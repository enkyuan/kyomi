import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { UpstreamError } from "@shared/effect/errors";
import {
  BlockedOutboundUrlError,
  checkOutboundUrl,
  HostResolver,
  isBlockedOutboundIpAddress,
} from "@shared/net/outbound";

/** Check `url` with a resolver that answers `addresses` for any hostname (no DNS). */
function check(url: string, addresses: readonly string[] = []) {
  return Effect.runPromise(
    Effect.flip(checkOutboundUrl(new URL(url))).pipe(
      Effect.provideService(HostResolver, () => Effect.succeed(addresses)),
    ),
  ).then(
    (error) => error,
    () => undefined,
  );
}

const succeeds = (url: string, addresses: readonly string[]) =>
  Effect.runPromise(
    checkOutboundUrl(new URL(url)).pipe(
      Effect.provideService(HostResolver, () => Effect.succeed(addresses)),
    ),
  );

describe("outbound URL policy", () => {
  test("blocks literal private and shared-address-space URLs", async () => {
    for (const url of [
      "http://127.0.0.1/feed.xml",
      "http://10.0.0.4/feed.xml",
      "http://172.16.0.4/feed.xml",
      "http://192.168.0.4/feed.xml",
      "http://169.254.169.254/latest/meta-data",
      "http://100.64.1.181/feed.xml",
      "http://[::1]/feed.xml",
    ]) {
      const error = await check(url);
      expect(error).toMatchObject({ _tag: "UnsafeOutboundUrl" });
      expect((error as { cause?: unknown }).cause).toBeInstanceOf(BlockedOutboundUrlError);
    }
  });

  test("blocks private hostnames without resolving them", async () => {
    for (const url of [
      "http://localhost/feed",
      "http://printer.local/feed",
      "http://metadata.google.internal/",
    ]) {
      expect(await check(url, ["93.184.216.34"])).toMatchObject({
        _tag: "UnsafeOutboundUrl",
        message: "Private network URLs are not allowed",
      });
    }
  });

  test("blocks a public name that resolves to a private address", async () => {
    expect(
      await check("https://rebind.example.com/feed", ["93.184.216.34", "10.0.0.8"]),
    ).toMatchObject({ _tag: "UnsafeOutboundUrl" });
    expect(await check("https://mapped.example.com/feed", ["::ffff:127.0.0.1"])).toMatchObject({
      _tag: "UnsafeOutboundUrl",
    });
  });

  test("allows a public name, including shared-address-space DNS answers", async () => {
    await succeeds("https://example.com/feed", ["93.184.216.34"]);
    await succeeds("https://carrier.example.com/feed", ["100.64.1.181"]);
  });

  test("a resolver failure is an UpstreamError, not a verdict on the URL", async () => {
    const failure = new UpstreamError({ operation: "resolve outbound host", cause: "ENOTFOUND" });

    const error = await Effect.runPromise(
      Effect.flip(checkOutboundUrl(new URL("https://nowhere.example.com/"))).pipe(
        Effect.provideService(HostResolver, () => Effect.fail(failure)),
      ),
    );

    expect(error).toBe(failure);
  });

  test("allows shared-address-space DNS answers for non-literal hostnames", () => {
    expect(isBlockedOutboundIpAddress("100.64.1.181", { blockSharedAddressSpace: false })).toBe(
      false,
    );
    expect(isBlockedOutboundIpAddress("100.64.1.181", { blockSharedAddressSpace: true })).toBe(
      true,
    );
  });

  test("blocks special-use ranges beyond the private ones", () => {
    for (const address of [
      "192.0.0.192",
      "192.0.2.1",
      "198.18.0.1",
      "198.51.100.7",
      "203.0.113.9",
      "224.0.0.1",
      "239.255.255.250",
      "240.0.0.1",
      "255.255.255.255",
      "fec0::1",
      "ff02::1",
      "64:ff9b::7f00:1",
      "2002:7f00:1::",
      "2001:db8::1",
      "fd00:ec2::254",
      "fe90::1",
      "::ffff:10.0.0.8",
    ]) {
      expect(isBlockedOutboundIpAddress(address)).toBe(true);
    }
  });

  test("does not block ordinary public addresses", () => {
    for (const address of [
      "93.184.216.34",
      "8.8.8.8",
      "1.1.1.1",
      "2606:4700:4700::1111",
      "2a00:1450:4001::200e",
    ]) {
      expect(isBlockedOutboundIpAddress(address)).toBe(false);
    }
  });

  test("blocks names that only mean something inside a network", async () => {
    for (const url of [
      "http://redis:6379/",
      "http://postgres/",
      "http://localhost./feed",
      "http://x.localhost/feed",
      "http://foo.internal/feed",
      "http://[fd00:ec2::254]/",
      "http://[fe90::1]/",
      "http://0.1.2.3/",
    ]) {
      expect(await check(url, ["93.184.216.34"])).toMatchObject({ _tag: "UnsafeOutboundUrl" });
    }
  });
});

import { describe, expect, test } from "bun:test";
import {
  assertSafeOutboundUrl,
  BlockedOutboundUrlError,
  isBlockedOutboundIpAddress,
} from "@shared/net/outbound-policy";

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
      await expect(assertSafeOutboundUrl(new URL(url))).rejects.toBeInstanceOf(
        BlockedOutboundUrlError,
      );
    }
  });

  test("allows shared-address-space DNS answers for non-literal hostnames", () => {
    expect(
      isBlockedOutboundIpAddress("100.64.1.181", {
        blockSharedAddressSpace: false,
      }),
    ).toBe(false);
    expect(
      isBlockedOutboundIpAddress("100.64.1.181", {
        blockSharedAddressSpace: true,
      }),
    ).toBe(true);
  });
});

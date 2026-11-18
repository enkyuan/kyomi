import { mock } from "bun:test";

/**
 * Makes every hostname resolve to one public address, so code that checks a name before it fetches
 * (`@kyomi/ingest/lib/outbound`) needs no network in a test. Call it at the top of a test file;
 * `--isolate` keeps it from reaching other files. `answer` overrides the address list per name.
 */
export function resolveHostsPublicly(
  answer: (hostname: string) => string[] = () => ["93.184.216.34"],
) {
  mock.module("node:dns/promises", () => ({
    lookup: async (hostname: string) =>
      answer(hostname).map((address) => ({ address, family: address.includes(":") ? 6 : 4 })),
  }));
}

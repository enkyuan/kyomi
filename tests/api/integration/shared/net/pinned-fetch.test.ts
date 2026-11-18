import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { HostResolver } from "@shared/net/outbound";
import { pinnedFetch } from "@kyomi/ingest/lib/outbound";
import { safeFetch } from "@shared/net/safe-fetch";

const servers: Array<{ stop: (force?: boolean) => void }> = [];
afterEach(() => {
  for (const server of servers.splice(0)) {
    server.stop(true);
  }
});

describe("pinnedFetch", () => {
  test("connects to the given address whatever the URL's name resolves to, and keeps the Host", async () => {
    const server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: (request) => new Response(`host=${request.headers.get("host")}`),
    });
    servers.push(server);

    // `.invalid` never resolves, so this only works if the connection goes to the address.
    const response = await pinnedFetch("127.0.0.1")(
      new URL(`http://feeds.pinned.invalid:${server.port}/feed.xml`),
    );

    expect(await response.text()).toBe(`host=feeds.pinned.invalid:${server.port}`);
  });

  const openssl = Bun.spawnSync(["openssl", "version"]).success;

  test.skipIf(!openssl)(
    "over TLS the certificate is still checked against the host, not the address",
    async () => {
      const dir = mkdtempSync(path.join(tmpdir(), "pinned-fetch-"));
      const keyPath = path.join(dir, "key.pem");
      const certPath = path.join(dir, "cert.pem");
      Bun.spawnSync([
        "openssl",
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        keyPath,
        "-out",
        certPath,
        "-days",
        "2",
        "-subj",
        "/CN=pinned.test",
        "-addext",
        "subjectAltName=DNS:pinned.test",
      ]);
      const cert = readFileSync(certPath, "utf8");
      const server = Bun.serve({
        port: 0,
        hostname: "127.0.0.1",
        tls: { cert, key: readFileSync(keyPath, "utf8") },
        fetch: (request) => new Response(`host=${request.headers.get("host")}`),
      });
      servers.push(server);
      const pinned = pinnedFetch("127.0.0.1");
      const trusting = { tls: { ca: cert } } as RequestInit;

      const matching = await pinned(new URL(`https://pinned.test:${server.port}/`), trusting);
      expect(await matching.text()).toBe(`host=pinned.test:${server.port}`);

      // The address answers for the wrong name: the certificate must not be accepted.
      await expect(
        pinned(new URL(`https://other.test:${server.port}/`), trusting),
      ).rejects.toMatchObject({ code: "ERR_TLS_CERT_ALTNAME_INVALID" });
    },
  );
});

describe("safeFetch against a name that changes its answer", () => {
  test("connects to the address it checked, not to what the name resolves to at connect time", async () => {
    let lookups = 0;
    const requested: Array<{ url: string; host: string | null }> = [];
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (
      input: URL | RequestInfo,
      init?: RequestInit,
    ) => {
      requested.push({
        url: String(input),
        host: new Headers(init?.headers).get("host"),
      });
      return new Response("ok");
    }) as unknown as typeof fetch);

    try {
      await Effect.runPromise(
        safeFetch(new URL("https://rebind.example/feed.xml")).pipe(
          Effect.scoped,
          // The first answer is public; a second lookup (what `fetch` would do) is never made.
          Effect.provideService(HostResolver, () =>
            Effect.sync(() => {
              lookups += 1;
              return ["93.184.216.34"];
            }),
          ),
          Effect.provide(FetchHttpClient.layer),
        ),
      );
    } finally {
      fetchSpy.mockRestore();
    }

    expect(lookups).toBe(1);
    expect(requested).toEqual([{ url: "https://93.184.216.34/feed.xml", host: "rebind.example" }]);
  });

  test("tries the next checked address when the first does not answer", async () => {
    const requested: string[] = [];
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (
      input: URL | RequestInfo,
    ) => {
      requested.push(new URL(String(input)).hostname);
      if (requested.length === 1) {
        throw new Error("connect ECONNREFUSED");
      }
      return new Response("ok");
    }) as unknown as typeof fetch);

    try {
      const status = await Effect.runPromise(
        safeFetch(new URL("http://two.example/")).pipe(
          Effect.scoped,
          Effect.map(({ response }) => response.status),
          Effect.provideService(HostResolver, () =>
            Effect.succeed(["2606:4700:4700::1111", "93.184.216.34", "93.184.216.35"]),
          ),
          Effect.provide(FetchHttpClient.layer),
        ),
      );
      expect(status).toBe(200);
    } finally {
      fetchSpy.mockRestore();
    }

    // IPv4 before IPv6, and the second address only after the first failed.
    expect(requested).toEqual(["93.184.216.34", "93.184.216.35"]);
  });

  test("a literal address is requested as written", async () => {
    const requested: string[] = [];
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (
      input: URL | RequestInfo,
    ) => {
      requested.push(String(input));
      return new Response("ok");
    }) as unknown as typeof fetch);

    try {
      await Effect.runPromise(
        safeFetch(new URL("http://93.184.216.34/x")).pipe(
          Effect.scoped,
          Effect.provide(FetchHttpClient.layer),
        ),
      );
    } finally {
      fetchSpy.mockRestore();
    }

    expect(requested).toEqual(["http://93.184.216.34/x"]);
  });
});

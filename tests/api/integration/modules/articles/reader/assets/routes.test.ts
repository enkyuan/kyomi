import { afterEach, describe, expect, test } from "bun:test";
import { Layer, ManagedRuntime } from "effect";
import { readerAssetPlugin } from "@modules/articles/reader/assets/routes";
import { fakeHttpClient, recordingLogger, testConfig } from "@api-tests/support/layers";
import { registerTestErrorHandlers } from "@api-tests/support/elysia";

const runtimes: Array<{ dispose: () => Promise<void> }> = [];

function appWith(respond: Parameters<typeof fakeHttpClient>[0]) {
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(fakeHttpClient(respond), recordingLogger().layer, testConfig()),
  );
  runtimes.push(runtime);
  const app = readerAssetPlugin(runtime);
  registerTestErrorHandlers(app);
  return app;
}

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});

describe("reader image route", () => {
  test("proxies a public image without a session", async () => {
    const app = appWith(
      () => new Response(new Uint8Array([1, 2]), { headers: { "content-type": "image/gif" } }),
    );

    const response = await app.handle(
      new Request(
        `http://localhost/api/reader-image?url=${encodeURIComponent("https://93.184.216.34/a.gif")}`,
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/gif");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2]));
  });

  test("answers a missing url with an empty 400", async () => {
    const response = await appWith(() => new Response("unexpected")).handle(
      new Request("http://localhost/api/reader-image"),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("");
  });
});

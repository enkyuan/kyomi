import { describe, expect, test } from "bun:test";
import { corsPlugin } from "@adapters/cors/plugin";
import { Elysia } from "@api-tests/support/elysia";

describe("corsPlugin", () => {
  test("allows the configured web origin with credentials", async () => {
    const app = new Elysia()
      .use(corsPlugin({ WEB_ORIGIN: "https://app.kyomi.test" }))
      .get("/probe", () => "ok") as unknown as { handle(request: Request): Promise<Response> };

    const response = await app.handle(
      new Request("http://localhost/probe", { headers: { origin: "https://app.kyomi.test" } }),
    );

    expect(response.headers.get("access-control-allow-origin")).toBe("https://app.kyomi.test");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });
});

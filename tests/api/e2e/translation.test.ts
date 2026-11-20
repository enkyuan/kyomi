import { expect, test } from "bun:test";
import gateway from "../../../apps/ai-gateway/src/index";

// Real session, API, PostgreSQL, Redis stream consumer and gateway. Only Workers AI is local.
test.skipIf(!process.env.ONBOARDING_TEST_DATABASE_URL)(
  "onboarding language drives a durable toolbar translation",
  async () => {
    const calls: Record<string, unknown>[] = [];
    const provider = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: (request) =>
        gateway.fetch(request, {
          TRANSLATIONS_TOKEN: "fixture",
          AI: {
            async run(_model, input) {
              calls.push(input);
              return { translated_text: "Voici la traduction." };
            },
          },
        }),
    });
    Object.assign(process.env, {
      DATABASE_URL: process.env.ONBOARDING_TEST_DATABASE_URL,
      FEATURE_ARTICLE_TRANSLATIONS: "true",
      CLOUDFLARE_TRANSLATIONS_URL: new URL("/translate", provider.url).href,
      CLOUDFLARE_TRANSLATIONS_TOKEN: "fixture",
      JOB_STREAMS: "jobs:article-translation",
    });
    const { createAppRuntime } = await import("@app/runtime");
    const { AppConfig } = await import("@config/env/service");
    const { Db } = await import("@adapters/db/service");
    const { createAuth } = await import("@adapters/auth/instance");
    const { createApp } = await import("@app/http/app");
    const runtime = createAppRuntime();
    const config = await runtime.runPromise(AppConfig);
    const { pool, client } = await runtime.runPromise(Db);
    const auth = createAuth({ config, db: client, sendOtp: () => {} });
    const app = createApp({ runtime });
    const email = crypto.randomUUID() + "@example.org";
    const otp = await auth.api.createVerificationOTP({ body: { type: "sign-in", email } });
    const login = await auth.api.signInEmailOTP({ body: { email, otp }, asResponse: true });
    const cookie = login.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const request = (path: string, method = "GET", body?: unknown, session = cookie) =>
      app.fetch(
        new Request("http://localhost/api/v1" + path, {
          method,
          headers: { cookie: session, "content-type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      );
    const id = crypto.randomUUID();
    const url = "https://example.org/" + id;
    const prose =
      "This article contains enough stored text for the reader to show its full original body. " +
      id;
    const worker = Bun.spawn([process.execPath, "src/app/boot/worker.ts"], {
      cwd: new URL("../../../apps/api/", import.meta.url).pathname,
      env: { ...process.env },
      stdout: "ignore",
      stderr: "inherit",
    });
    try {
      expect(
        (
          await request("/me/onboarding", "PATCH", {
            name: "Reader",
            username: "u" + id.slice(0, 8),
            language: "fr-ca",
            categories: ["Technology"],
            bundleIds: ["technology"],
          })
        ).status,
      ).toBe(200);
      expect((await request("/me/onboarding/completion", "PUT")).status).toBe(200);
      expect(await (await request("/me/preferences")).json()).toMatchObject({ language: "fr-CA" });
      await pool.query(
        "insert into feed_items(id,feed_id,canonical_url,link,title,content_text,language,published_at) select $1,id,$2,$2,'translation fixture',$3,'en-US',now() from feeds limit 1",
        [id, url, prose],
      );
      const path = "/articles/" + id;
      expect((await request(path + "/translate", "POST", {}, "")).status).toBe(401);
      const responses = await Promise.all([
        request(path + "/translate", "POST", {}),
        request(path + "/translate", "POST", {}),
      ]);
      const [first, second] = await Promise.all(responses.map((r) => r.json()));
      expect(first).toMatchObject({ target_language: "fr", source_language: "en" });
      expect(second.id).toBe(first.id);
      const status = path + "/translations/" + first.id;
      expect((await request(status, "GET", undefined, "")).status).toBe(401);
      expect(
        (await request("/articles/" + crypto.randomUUID() + "/translations/" + first.id)).status,
      ).toBe(404);
      let result = first;
      for (let i = 0; i < 100 && result.status !== "ready"; i++) {
        await Bun.sleep(100);
        result = await (await request(status)).json();
      }
      expect(result).toMatchObject({ status: "ready", translated_content: "Voici la traduction." });
      expect(await (await request(path + "/translate", "POST", {})).json()).toEqual(result);
      expect(calls.filter((call) => call.text === prose)).toEqual([
        { text: prose, source_lang: "en", target_lang: "fr" },
      ]);
      expect(
        await (await request("/me/preferences", "PATCH", { language: "de-de" })).json(),
      ).toMatchObject({ language: "de-DE" });
      expect(await (await request(path + "/translate", "POST", {})).json()).toMatchObject({
        target_language: "de",
        id: expect.not.stringMatching(first.id),
      });
    } finally {
      worker.kill();
      await worker.exited;
      provider.stop(true);
      await runtime.dispose();
    }
  },
  30000,
);

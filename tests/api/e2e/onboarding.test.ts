import { expect, test } from "bun:test";

// Run against a disposable, migrated database. This journey creates accounts and subscriptions.
test.skipIf(!process.env.ONBOARDING_TEST_DATABASE_URL)(
  "session renewal, concurrent handle claims and atomic feed seeding",
  async () => {
    process.env.DATABASE_URL = process.env.ONBOARDING_TEST_DATABASE_URL!;
    const { createApp } = await import("@app/http/app");
    const { createAppRuntime } = await import("@app/runtime");
    const { createAuth } = await import("@adapters/auth/instance");
    const { Db } = await import("@adapters/db/service");
    const { AppConfig } = await import("@config/env/service");
    const runtime = createAppRuntime();
    const { pool, client } = await runtime.runPromise(Db);
    const config = await runtime.runPromise(AppConfig);
    const auth = createAuth({ config, db: client, sendOtp: () => {} });
    const app = createApp({ runtime });
    const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: app.fetch });
    const address = new URL("/api/v1/me/onboarding", server.url).href;
    const suffix = crypto.randomUUID().slice(0, 8);
    const username = "reader_" + suffix;
    async function login(email: string) {
      const otp = await auth.api.createVerificationOTP({ body: { type: "sign-in", email } });
      const result = await auth.api.signInEmailOTP({ body: { email, otp }, asResponse: true });
      expect(result.status).toBe(200);
      const cookie = result.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      expect(cookie.length).toBeGreaterThan(0);
      return cookie;
    }
    function request(cookie: string, method = "GET", path = "", body?: unknown) {
      return fetch(address + path, {
        method,
        headers: { cookie, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }
    try {
      expect((await request("")).status).toBe(401);
      const email = username + "@example.org";
      const first = await login(email);
      const second = await login("other_" + email);
      const initial = await request(first);
      expect(initial.headers.get("cache-control")).toContain("no-store");
      expect(await initial.json()).toMatchObject({ status: "pending", nextField: "username" });
      const incomplete = await request(first, "PUT", "/completion");
      expect(incomplete.status).toBe(422);
      expect(await incomplete.json()).toMatchObject({
        error: {
          code: "VALIDATION_ERROR",
          details: {
            issues: expect.arrayContaining([expect.objectContaining({ path: ["username"] })]),
          },
        },
      });
      const patch = {
        username: "@" + username.toUpperCase(),
        language: "en-us",
        categories: ["Technology", "Design & UX", "Science & Research"],
        bundleIds: ["technology"],
      };
      expect((await request(first, "PATCH", "", { name: "Reader" })).status).toBe(422);
      expect((await request(first, "PATCH", "", { username })).status).toBe(200);
      expect(await (await request(first, "GET", "/status")).json()).toEqual({ status: "pending" });
      const renewed = await login(email);
      expect(await (await request(renewed)).json()).toMatchObject({
        draft: { username },
        nextField: "categories",
      });
      expect(await (await request(second)).json()).toMatchObject({ draft: {} });
      for (const cookie of [renewed, second])
        expect((await request(cookie, "PATCH", "", patch)).status).toBe(200);
      const accounts = [renewed, second];
      const results = await Promise.all(
        accounts.map((cookie) => request(cookie, "PUT", "/completion")),
      );
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(await results.find((response) => response.status === 409)!.json()).toMatchObject({
        error: { code: "USERNAME_TAKEN", details: { field: "username" } },
      });
      const winner = accounts[results.findIndex((r) => r.ok)]!;
      const loser = accounts[results.findIndex((r) => !r.ok)]!;
      expect(await (await request(winner, "PUT", "/completion")).json()).toMatchObject({
        status: "complete",
        draft: { username, language: "en-US" },
      });
      expect((await request(winner, "PATCH", "", { language: "es" })).status).toBe(409);
      expect(await (await request(loser)).json()).toMatchObject({ status: "pending" });
      expect(await (await request(winner, "GET", "/status")).json()).toEqual({
        status: "complete",
      });
      for (let attempt = 0; attempt < 2; attempt++) {
        expect(
          await (await request(loser, "GET", "/username?username=" + username)).json(),
        ).toEqual({
          username,
          available: false,
        });
      }
      const seeded = await pool.query(
        "select count(*)::int as count from feed_subscriptions join user_onboarding using (user_id) where username = $1",
        [username],
      );
      expect(seeded.rows[0].count).toBe(4);
      const retry = { username: "other_" + username, bundleIds: ["technology", "science"] };
      expect((await request(loser, "PATCH", "", retry)).status).toBe(200);
      expect((await request(loser, "PUT", "/completion")).status).toBe(200);
      const subscriptions = await pool.query(
        "select count(*)::int as count from feed_subscriptions join user_onboarding using (user_id) where username = $1",
        [retry.username],
      );
      expect(subscriptions.rows).toEqual([{ count: 8 }]);
      const expiredCookie = await login(email);
      const expiredSession = await auth.api.getSession({
        headers: new Headers({ cookie: expiredCookie }),
      });
      await pool.query(
        "update sessions set expires_at = now() - interval '1 minute' where id = $1",
        [expiredSession!.session.id],
      );
      expect((await request(expiredCookie, "PUT", "/completion")).status).toBe(401);
      await auth.api.signOut({ headers: new Headers({ cookie: renewed }) });
      expect((await request(renewed)).status).toBe(401);
    } finally {
      server.stop(true);
      await runtime.dispose();
    }
  },
  30000,
);

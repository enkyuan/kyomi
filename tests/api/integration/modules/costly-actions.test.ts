import { afterEach, describe, expect, test } from "bun:test";
import { Layer, ManagedRuntime } from "effect";
import { registerFeedRefreshRoutes } from "@modules/feeds/refresh/routes";
import { registerArticleEnrichmentRoutes } from "@modules/articles/reader/routes";
import { registerArticleWriteRoutes } from "@modules/articles/write/routes";
import { RateLimited } from "@shared/effect/errors";
import { Elysia, registerTestErrorHandlers } from "@api-tests/support/elysia";

/**
 * Actions that fetch another server, compile a page or call a paid model are limited per user.
 * The runtime here has no services at all, so a request that got past the limiter would fail
 * rather than answer: a 429 with the rule's name shows the limiter ran first.
 */

const runtimes: Array<{ dispose: () => Promise<void> }> = [];
afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});

type Rule = { name: string; max: number; windowMs: number };

function appWith(register: (app: never, runtime: never) => unknown, refuse: boolean) {
  const consulted: Array<{ subject: string; rule: Rule }> = [];
  const runtime = ManagedRuntime.make(Layer.empty);
  runtimes.push(runtime);
  const app = new Elysia()
    .decorate("enforceRateLimit", async (subject: string, rule: Rule) => {
      consulted.push({ subject, rule });
      if (refuse) {
        throw new RateLimited({ message: "Too many requests", code: "RATE_LIMITED" });
      }
    })
    .derive(() => ({ userId: "user-1", requestId: "req-1" }));
  registerTestErrorHandlers(app);
  register(app as never, runtime as never);
  return { app, consulted };
}

const ARTICLE = "11111111-1111-4111-8111-111111111111";
const json = (method: string, path: string, body?: unknown) => {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(payload ? { "content-length": String(Buffer.byteLength(payload)) } : {}),
    },
    body: payload,
  });
};

const costly: Array<{
  rule: string;
  register: (app: never, runtime: never) => unknown;
  request: () => Request;
}> = [
  {
    rule: "feeds.refresh_one",
    register: registerFeedRefreshRoutes as never,
    request: () => json("POST", `/feeds/${ARTICLE}/refresh`),
  },
  {
    rule: "feeds.refresh_all",
    register: registerFeedRefreshRoutes as never,
    request: () => json("POST", "/feeds/refresh", {}),
  },
  {
    rule: "articles.clip_create",
    register: registerArticleWriteRoutes as never,
    request: () => json("POST", "/articles", { url: "https://example.com/post" }),
  },
  {
    rule: "articles.clip_content",
    register: registerArticleWriteRoutes as never,
    request: () => json("PUT", `/articles/${ARTICLE}`, { contentHtml: "<p>x</p>" }),
  },
  {
    rule: "articles.extract",
    register: registerArticleEnrichmentRoutes as never,
    request: () => json("POST", `/articles/${ARTICLE}/extract-full-text`),
  },
  {
    rule: "articles.summarize",
    register: registerArticleEnrichmentRoutes as never,
    request: () => json("POST", `/articles/${ARTICLE}/summarize`, {}),
  },
  {
    rule: "articles.translate",
    register: registerArticleEnrichmentRoutes as never,
    request: () => json("POST", `/articles/${ARTICLE}/translate`, { target_language: "fr" }),
  },
];

describe("costly actions are rate limited per user", () => {
  test.each(costly)("$rule answers 429 once the user's limit is used up", async (action) => {
    const { app, consulted } = appWith(action.register, true);

    const response = await app.handle(action.request());

    expect(response.status).toBe(429);
    expect(consulted).toHaveLength(1);
    expect(consulted[0]).toMatchObject({ subject: "user-1", rule: { name: action.rule } });
  });

  test("a read, saved or hidden toggle is not counted against the clip limit", async () => {
    const { app, consulted } = appWith(registerArticleWriteRoutes as never, true);

    await app.handle(json("PUT", `/articles/${ARTICLE}`, { isRead: true }));

    expect(consulted).toEqual([]);
  });
});

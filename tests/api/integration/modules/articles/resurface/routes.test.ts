import { afterEach, describe, expect, mock, test } from "bun:test";
import { Layer, ManagedRuntime } from "effect";
import { registerArticleResurfaceRoutes } from "@modules/articles/resurface/routes";
import { Elysia, registerTestErrorHandlers } from "@api-tests/support/elysia";
import { fakeDb, testConfig } from "@api-tests/support/layers";
import {
  clipCandidateRow,
  createViewDb,
  createWriteDb,
  feedCandidateRow,
  readingRow,
} from "./fakes";

const USER_ID = "user-1";
const ARTICLE_ID = "0b0f5b9e-6f7c-4a3e-9b53-1c2d3e4f5a6b";
const OTHER_ID = "7a1d2c3b-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

type Routed = { handle(request: Request): Promise<Response> };

const runtimes: Array<{ dispose: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});

function createApp(database: Parameters<typeof fakeDb>[0]) {
  const runtime = ManagedRuntime.make(Layer.mergeAll(fakeDb(database), testConfig()));
  runtimes.push(runtime);
  const enforceRateLimit = mock(async (..._args: unknown[]) => {});
  // What `/api/v1` provides before a domain route runs: the session, a request id and the limiter.
  const authenticated = new Elysia({ prefix: "/api/v1" })
    .decorate({ enforceRateLimit })
    .derive(() => ({ userId: USER_ID, requestId: "req-1" }));
  // Hooks only reach routes registered after them.
  registerTestErrorHandlers(authenticated);
  const app = registerArticleResurfaceRoutes(authenticated as never, runtime) as unknown as Routed;
  return { app, enforceRateLimit };
}

function post(path: string, body?: unknown) {
  return new Request(`http://localhost/api/v1${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("registerArticleResurfaceRoutes", () => {
  test("registers the three endpoints", () => {
    const recorded: string[] = [];
    const recorder = {
      get(path: string) {
        recorded.push(`get ${path}`);
        return recorder;
      },
      post(path: string) {
        recorded.push(`post ${path}`);
        return recorder;
      },
    };

    registerArticleResurfaceRoutes(
      recorder as never,
      ManagedRuntime.make(Layer.mergeAll(fakeDb(), testConfig())),
    );

    expect(recorded).toEqual([
      "get /articles/views/continue-reading",
      "post /articles/views/continue-reading/impressions",
      "post /articles/:articleId/continue-reading/dismiss",
    ]);
  });

  describe("GET /articles/views/continue-reading", () => {
    test("returns the top items as a list response", async () => {
      const fake = createViewDb({
        feed: [feedCandidateRow({ reading: readingRow({ feedItemId: "item-a" }) })],
        clips: [clipCandidateRow(readingRow({ feedItemId: null, clipId: "clip-1" }), "clip-1")],
      });
      const { app } = createApp(fake.db);

      const response = await app.handle(
        new Request("http://localhost/api/v1/articles/views/continue-reading?limit=1"),
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        items: Array<{ id: string; readingProgress: { state: string } }>;
        next_cursor: string | null;
        has_more: boolean;
        total_count: null;
      };
      expect(body.items).toHaveLength(1);
      expect(body.items[0]!.readingProgress.state).toBe("reading");
      expect(body.next_cursor).toBeNull();
      expect(body.has_more).toBe(false);
    });

    test("defaults the limit to 5 and clamps an oversized limit", async () => {
      const feed = Array.from({ length: 30 }, (_, index) =>
        feedCandidateRow({
          reading: readingRow({ feedItemId: `item-${index}`, maxProgress: 0.1 + index * 0.01 }),
        }),
      );
      const { app } = createApp(createViewDb({ feed }).db);

      const defaulted = await app.handle(
        new Request("http://localhost/api/v1/articles/views/continue-reading"),
      );
      const clamped = await app.handle(
        new Request("http://localhost/api/v1/articles/views/continue-reading?limit=999"),
      );

      expect(((await defaulted.json()) as { items: unknown[] }).items).toHaveLength(5);
      expect(((await clamped.json()) as { items: unknown[] }).items).toHaveLength(20);
    });
  });

  describe("POST /articles/views/continue-reading/impressions", () => {
    test("applies impressions for the caller and answers with a message", async () => {
      const fake = createWriteDb([{ reading: readingRow({ feedItemId: ARTICLE_ID }) }]);
      const { app, enforceRateLimit } = createApp(fake.db);

      const response = await app.handle(
        post("/articles/views/continue-reading/impressions", { articleIds: [ARTICLE_ID] }),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ message: "Impressions recorded" });
      expect(enforceRateLimit).toHaveBeenCalledTimes(1);
      expect(fake.updates).toHaveLength(1);
    });

    test("rejects empty, oversized, and non-uuid id lists without touching the database", async () => {
      const fake = createWriteDb([]);
      const { app } = createApp(fake.db);
      const tooMany = Array.from({ length: 21 }, () => ARTICLE_ID);

      for (const articleIds of [[], tooMany, ["not-a-uuid"]]) {
        const response = await app.handle(
          post("/articles/views/continue-reading/impressions", { articleIds }),
        );
        expect(response.status).toBe(422);
      }
      const missing = await app.handle(post("/articles/views/continue-reading/impressions", {}));
      expect(missing.status).toBe(422);
      expect(fake.transactions).toBe(0);
    });

    test("accepts the maximum of 20 ids", async () => {
      const fake = createWriteDb([]);
      const { app } = createApp(fake.db);
      const ids = Array.from({ length: 20 }, () => OTHER_ID);

      const response = await app.handle(
        post("/articles/views/continue-reading/impressions", { articleIds: ids }),
      );

      expect(response.status).toBe(200);
    });
  });

  describe("POST /articles/:articleId/continue-reading/dismiss", () => {
    test("dismisses the caller's article", async () => {
      const fake = createWriteDb([{ reading: readingRow({ feedItemId: ARTICLE_ID }) }]);
      const { app, enforceRateLimit } = createApp(fake.db);

      const response = await app.handle(post(`/articles/${ARTICLE_ID}/continue-reading/dismiss`));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ message: "Article dismissed from continue reading" });
      expect(enforceRateLimit).toHaveBeenCalledTimes(1);
      expect(fake.updates[0]!.set).toMatchObject({
        state: "dismissed",
        dismissedAt: expect.any(Date),
      });
    });

    test("answers 404 in the error envelope when the article is not the caller's", async () => {
      const fake = createWriteDb([]);
      const { app } = createApp(fake.db);

      const response = await app.handle(post(`/articles/${ARTICLE_ID}/continue-reading/dismiss`));

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        error: { code: "ARTICLE_NOT_FOUND", message: "Article not found" },
      });
    });

    test("rejects a non-uuid article id", async () => {
      const fake = createWriteDb([]);
      const { app } = createApp(fake.db);

      const response = await app.handle(post("/articles/not-a-uuid/continue-reading/dismiss"));

      expect(response.status).toBe(422);
      expect(fake.transactions).toBe(0);
    });

    test("does not reach the database when the rate limit rejects the call", async () => {
      const fake = createWriteDb([{ reading: readingRow({ feedItemId: ARTICLE_ID }) }]);
      const { app, enforceRateLimit } = createApp(fake.db);
      enforceRateLimit.mockImplementation(async () => {
        throw new Error("rate limited");
      });

      const response = await app.handle(post(`/articles/${ARTICLE_ID}/continue-reading/dismiss`));

      expect(response.status).toBe(500);
      expect(fake.transactions).toBe(0);
    });
  });
});

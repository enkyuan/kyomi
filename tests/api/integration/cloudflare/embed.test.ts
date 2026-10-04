import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { CLOUDFLARE_EMBEDDING_MODEL, embedTexts } from "@kyomi/worker";
import worker from "../../../../apps/embeddings/src/index";

type WorkerEnv = Parameters<typeof worker.fetch>[1];

const TOKEN = "test-embeddings-token";
const EMBED_URL = "https://embeddings.test/embed";
const originalFetch = globalThis.fetch;

/** Distinct per input text, so a vector landing on the wrong input fails the comparison. */
function vectorFor(text: string): number[] {
  return [text.length, text.charCodeAt(text.length - 1)];
}

function articleTexts(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `article-${index}`);
}

/** Workers AI stand-in that records each call and can fail or drop a vector on a given call. */
function fakeAi(
  options: { failOnCall?: number; shortOnCall?: number; omitData?: boolean; delayMs?: number } = {},
) {
  const calls: Array<{ model: string; text: string[] }> = [];
  const concurrency = { inFlight: 0, max: 0 };
  return {
    calls,
    concurrency,
    async run(model: string, input: { text: string[] }) {
      calls.push({ model, text: input.text });
      const call = calls.length;
      if (call === options.failOnCall) {
        throw new Error("Workers AI capacity exceeded");
      }
      concurrency.inFlight += 1;
      concurrency.max = Math.max(concurrency.max, concurrency.inFlight);
      try {
        if (options.delayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.delayMs));
        }
        if (options.omitData) {
          return {};
        }
        const data = input.text.map(vectorFor);
        return { data: call === options.shortOnCall ? data.slice(0, -1) : data };
      } finally {
        concurrency.inFlight -= 1;
      }
    },
  };
}

function embedRequest(
  body: unknown,
  options: { authorization?: string | null; rawBody?: string } = {},
): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  const authorization =
    options.authorization === undefined ? `Bearer ${TOKEN}` : options.authorization;
  if (authorization !== null) {
    headers.set("Authorization", authorization);
  }
  return new Request(EMBED_URL, {
    method: "POST",
    headers,
    body: options.rawBody ?? JSON.stringify(body),
  });
}

function callWorker(request: Request, env: WorkerEnv): Promise<Response> {
  return worker.fetch(request, env);
}

let consoleError: ReturnType<typeof spyOn>;

beforeEach(() => {
  consoleError = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
  globalThis.fetch = originalFetch;
});

describe("embeddings Worker routes", () => {
  test("serves health checks without a token", async () => {
    const response = await callWorker(new Request("https://embeddings.test/health"), {
      AI: fakeAi(),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  test("returns 404 for other routes and methods", async () => {
    const env = { AI: fakeAi(), EMBEDDINGS_TOKEN: TOKEN };

    expect((await callWorker(new Request(EMBED_URL), env)).status).toBe(404);
    expect(
      (await callWorker(new Request("https://embeddings.test/other", { method: "POST" }), env))
        .status,
    ).toBe(404);
  });
});

describe("embeddings Worker auth", () => {
  test("refuses every request when EMBEDDINGS_TOKEN is not set", async () => {
    const ai = fakeAi();

    for (const authorization of ["Bearer undefined", "Bearer ", null]) {
      const response = await callWorker(embedRequest({ input: ["x"] }, { authorization }), {
        AI: ai,
      });
      expect(response.status).toBe(500);
    }
    expect(ai.calls).toHaveLength(0);
    expect(consoleError).toHaveBeenCalled();
  });

  test("rejects a missing or wrong bearer token without calling Workers AI", async () => {
    const ai = fakeAi();
    const env = { AI: ai, EMBEDDINGS_TOKEN: TOKEN };

    for (const authorization of [null, "Bearer wrong", `Bearer ${TOKEN}x`, TOKEN]) {
      const response = await callWorker(embedRequest({ input: ["x"] }, { authorization }), env);
      expect(response.status).toBe(401);
    }
    expect(ai.calls).toHaveLength(0);
  });
});

describe("embeddings Worker request validation", () => {
  test("rejects malformed bodies without calling Workers AI", async () => {
    const ai = fakeAi();
    const env = { AI: ai, EMBEDDINGS_TOKEN: TOKEN };

    const invalidJson = await callWorker(embedRequest(null, { rawBody: "{" }), env);
    expect(invalidJson.status).toBe(400);
    expect(await invalidJson.json()).toEqual({ error: "Invalid JSON body" });

    for (const body of [null, [], {}, { input: [] }, { input: ["a", 1] }, { input: 5 }]) {
      const response = await callWorker(embedRequest(body), env);
      expect(response.status).toBe(400);
    }
    expect(ai.calls).toHaveLength(0);
  });

  test("accepts up to 512 inputs and rejects anything over the cap", async () => {
    const ai = fakeAi();
    const env = { AI: ai, EMBEDDINGS_TOKEN: TOKEN };

    const atCap = await callWorker(embedRequest({ input: articleTexts(512) }), env);
    expect(atCap.status).toBe(200);
    expect(ai.calls).toHaveLength(64);

    ai.calls.length = 0;
    const overCap = await callWorker(embedRequest({ input: articleTexts(513) }), env);
    expect(overCap.status).toBe(413);
    expect(ai.calls).toHaveLength(0);
  });

  test("caps long inputs to their head and tail before embedding", async () => {
    const ai = fakeAi();
    const text = `${"h".repeat(5_000)}${"t".repeat(2_000)}`;

    const response = await callWorker(embedRequest({ input: text }), {
      AI: ai,
      EMBEDDINGS_TOKEN: TOKEN,
    });

    expect(response.status).toBe(200);
    const [sent] = ai.calls[0]?.text ?? [];
    expect(sent).toBe(`${"h".repeat(4_500)}\n\n[truncated]\n\n${"t".repeat(1_500)}`);
  });
});

describe("embeddings Worker responses", () => {
  test("embeds a single string with BGE-M3", async () => {
    const ai = fakeAi();

    const response = await callWorker(embedRequest({ input: "hello" }), {
      AI: ai,
      EMBEDDINGS_TOKEN: TOKEN,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [{ embedding: vectorFor("hello"), index: 0 }] });
    expect(ai.calls).toEqual([{ model: CLOUDFLARE_EMBEDDING_MODEL, text: ["hello"] }]);
  });

  test("batches inputs by eight and keeps every vector on its own input", async () => {
    const ai = fakeAi();
    const texts = articleTexts(20);

    const response = await callWorker(embedRequest({ input: texts }), {
      AI: ai,
      EMBEDDINGS_TOKEN: TOKEN,
    });

    expect(response.status).toBe(200);
    expect(ai.calls.map((call) => call.text.length)).toEqual([8, 8, 4]);
    const { data } = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };
    expect(data).toEqual(texts.map((text, index) => ({ embedding: vectorFor(text), index })));
  });

  test("runs up to four Workers AI batches at once", async () => {
    const ai = fakeAi({ delayMs: 5 });

    const response = await callWorker(embedRequest({ input: articleTexts(64) }), {
      AI: ai,
      EMBEDDINGS_TOKEN: TOKEN,
    });

    expect(response.status).toBe(200);
    expect(ai.calls).toHaveLength(8);
    expect(ai.concurrency.max).toBe(4);
  });

  test("fails the whole request when any batch fails", async () => {
    const ai = fakeAi({ failOnCall: 2 });

    // 40 inputs are five batches: the first four run together, so the fifth never starts.
    const response = await callWorker(embedRequest({ input: articleTexts(40) }), {
      AI: ai,
      EMBEDDINGS_TOKEN: TOKEN,
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Embedding provider failed" });
    expect(ai.calls).toHaveLength(4);
  });

  test("fails instead of misaligning vectors when Workers AI returns a short batch", async () => {
    const response = await callWorker(embedRequest({ input: articleTexts(12) }), {
      AI: fakeAi({ shortOnCall: 1 }),
      EMBEDDINGS_TOKEN: TOKEN,
    });

    expect(response.status).toBe(502);
  });

  test("fails when Workers AI returns no embeddings", async () => {
    const response = await callWorker(embedRequest({ input: ["a"] }), {
      AI: fakeAi({ omitData: true }),
      EMBEDDINGS_TOKEN: TOKEN,
    });

    expect(response.status).toBe(502);
  });
});

describe("embedTexts against the embeddings Worker", () => {
  function routeFetchToWorker(env: WorkerEnv) {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
      worker.fetch(new Request(input, init), env)) as unknown as typeof fetch;
  }

  const config = { apiKey: TOKEN, apiUrl: EMBED_URL, model: CLOUDFLARE_EMBEDDING_MODEL };

  test("returns one vector per text, in order, across Worker batches", async () => {
    routeFetchToWorker({ AI: fakeAi(), EMBEDDINGS_TOKEN: TOKEN });
    const texts = articleTexts(20);

    expect(await embedTexts(texts, config)).toEqual(texts.map(vectorFor));
  });

  test("rejects when the Worker refuses the token", async () => {
    routeFetchToWorker({ AI: fakeAi(), EMBEDDINGS_TOKEN: "rotated-token" });

    await expect(embedTexts(["a"], config)).rejects.toThrow(/401/);
  });

  test("rejects when Workers AI fails partway through", async () => {
    routeFetchToWorker({ AI: fakeAi({ failOnCall: 3 }), EMBEDDINGS_TOKEN: TOKEN });

    await expect(embedTexts(articleTexts(20), config)).rejects.toThrow(/502/);
  });
});

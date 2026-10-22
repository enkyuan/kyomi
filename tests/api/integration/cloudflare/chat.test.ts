import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import worker from "../../../../apps/embeddings/src/index";

const TOKEN = "test-embeddings-token";
const CHAT_URL = "https://embeddings.test/chat";
const MODEL = "@cf/openai/gpt-oss-120b";

/** Workers AI stand-in that records each call and answers with a fixed result or error. */
function fakeAi(result: unknown | (() => never)) {
  const calls: Array<{ model: string; input: Record<string, unknown> }> = [];
  return {
    calls,
    async run(model: string, input: Record<string, unknown>) {
      calls.push({ model, input });
      return typeof result === "function" ? (result as () => never)() : result;
    },
  };
}

function chatRequest(body: unknown, authorization: string | null = `Bearer ${TOKEN}`): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (authorization !== null) {
    headers.set("Authorization", authorization);
  }
  return new Request(CHAT_URL, { method: "POST", headers, body: JSON.stringify(body) });
}

const validBody = {
  model: MODEL,
  messages: [
    { role: "system", content: "Translate into German." },
    { role: "user", content: "<p>Hello</p>" },
  ],
  max_tokens: 1024,
};

let consoleError: ReturnType<typeof spyOn>;

beforeEach(() => {
  consoleError = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("chat route auth and validation", () => {
  test("rejects a missing or wrong bearer token without calling Workers AI", async () => {
    const ai = fakeAi({ response: "x" });

    for (const authorization of [null, "Bearer wrong"]) {
      const response = await worker.fetch(chatRequest(validBody, authorization), {
        AI: ai,
        EMBEDDINGS_TOKEN: TOKEN,
      });
      expect(response.status).toBe(401);
    }
    expect(ai.calls).toHaveLength(0);
  });

  test("rejects models outside the allowlist and out-of-range max_tokens", async () => {
    const ai = fakeAi({ response: "x" });
    const env = { AI: ai, EMBEDDINGS_TOKEN: TOKEN };

    for (const body of [
      { ...validBody, model: "@cf/meta/llama-3.1-8b-instruct" },
      { ...validBody, max_tokens: 0 },
      { ...validBody, max_tokens: 1_000_000 },
      { ...validBody, messages: [] },
      { ...validBody, messages: [{ role: "tool", content: "x" }] },
    ]) {
      expect((await worker.fetch(chatRequest(body), env)).status).toBe(400);
    }
    expect(ai.calls).toHaveLength(0);
  });
});

describe("chat route responses", () => {
  test("passes the request through without the model and normalizes chat completions", async () => {
    const ai = fakeAi({
      choices: [{ message: { content: "<p>Hallo</p>" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 12, completion_tokens: 5 },
    });

    const response = await worker.fetch(chatRequest({ ...validBody, reasoning_effort: "low" }), {
      AI: ai,
      EMBEDDINGS_TOKEN: TOKEN,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      model: MODEL,
      text: "<p>Hallo</p>",
      finish_reason: "stop",
      usage: { input_tokens: 12, output_tokens: 5 },
    });
    expect(ai.calls).toEqual([
      {
        model: MODEL,
        input: {
          messages: validBody.messages,
          max_tokens: 1024,
          reasoning_effort: "low",
        },
      },
    ]);
  });

  test("reads Responses API output items and legacy response strings", async () => {
    const env = (result: unknown) => ({ AI: fakeAi(result), EMBEDDINGS_TOKEN: TOKEN });

    const responses = await worker.fetch(
      chatRequest(validBody),
      env({
        output: [
          { type: "reasoning", content: [{ type: "reasoning_text", text: "thinking" }] },
          { type: "message", content: [{ type: "output_text", text: "<p>Hallo</p>" }] },
        ],
        usage: { input_tokens: 3, output_tokens: 4 },
        status: "completed",
      }),
    );
    expect(await responses.json()).toMatchObject({
      text: "<p>Hallo</p>",
      finish_reason: "completed",
      usage: { input_tokens: 3, output_tokens: 4 },
    });

    const legacy = await worker.fetch(chatRequest(validBody), env({ response: { score: 90 } }));
    expect(await legacy.json()).toMatchObject({ text: '{"score":90}' });
  });

  test("returns 502 when Workers AI fails or returns no text", async () => {
    const failing = await worker.fetch(chatRequest(validBody), {
      AI: fakeAi(() => {
        throw new Error("5016: model requires a paid plan");
      }),
      EMBEDDINGS_TOKEN: TOKEN,
    });
    expect(failing.status).toBe(502);
    expect(await failing.json()).toEqual({
      error: "Chat provider failed",
      detail: "5016: model requires a paid plan",
    });

    const empty = await worker.fetch(chatRequest(validBody), {
      AI: fakeAi({ usage: {} }),
      EMBEDDINGS_TOKEN: TOKEN,
    });
    expect(empty.status).toBe(502);
  });
});

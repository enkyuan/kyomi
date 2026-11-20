import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import worker from "../../../../apps/ai-gateway/src/index";

const TOKEN = "test-translations-token";
const TRANSLATE_URL = "https://ai-gateway.test/translate";
const MODEL = "@cf/meta/m2m100-1.2b";

type WorkerEnv = Parameters<typeof worker.fetch>[1];

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

function translateRequest(
  body: unknown,
  authorization: string | null = `Bearer ${TOKEN}`,
): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (authorization !== null) {
    headers.set("Authorization", authorization);
  }
  return new Request(TRANSLATE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

let consoleError: ReturnType<typeof spyOn>;

beforeEach(() => {
  consoleError = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("translation Worker route", () => {
  test("uses the distinct translation token and sends the Workers AI contract", async () => {
    const ai = fakeAi({ translated_text: "Kyomi organiza tus feeds." });
    const response = await worker.fetch(
      translateRequest({
        text: "Kyomi organizes your feeds.",
        source_language: "en",
        target_language: "es",
      }),
      { AI: ai, EMBEDDINGS_TOKEN: "embeddings-token", TRANSLATIONS_TOKEN: TOKEN },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      translated_text: "Kyomi organiza tus feeds.",
      source_language: "en",
      target_language: "es",
    });
    expect(ai.calls).toEqual([
      {
        model: MODEL,
        input: {
          text: "Kyomi organizes your feeds.",
          source_lang: "en",
          target_lang: "es",
        },
      },
    ]);
  });

  test("rejects a missing or wrong translation token without calling Workers AI", async () => {
    const ai = fakeAi({ translated_text: "ignored" });
    const env: WorkerEnv = { AI: ai, EMBEDDINGS_TOKEN: TOKEN, TRANSLATIONS_TOKEN: TOKEN };

    for (const authorization of [null, "Bearer wrong", "Bearer test-embeddings-token"]) {
      expect(
        (
          await worker.fetch(
            translateRequest(
              { text: "hello", source_language: "en", target_language: "es" },
              authorization,
            ),
            env,
          )
        ).status,
      ).toBe(401);
    }
    expect(ai.calls).toHaveLength(0);
  });

  test("rejects malformed and oversized input before spending Workers AI capacity", async () => {
    const ai = fakeAi({ translated_text: "ignored" });
    const env: WorkerEnv = { AI: ai, TRANSLATIONS_TOKEN: TOKEN };

    for (const body of [
      null,
      {},
      { text: "", source_language: "en", target_language: "es" },
      { text: "hello", source_language: "english", target_language: "es" },
      { text: "hello", source_language: "en", target_language: "spanish" },
    ]) {
      expect((await worker.fetch(translateRequest(body), env)).status).toBe(400);
    }
    expect(
      (
        await worker.fetch(
          translateRequest({
            text: "x".repeat(6_001),
            source_language: "en",
            target_language: "es",
          }),
          env,
        )
      ).status,
    ).toBe(413);
    expect(ai.calls).toHaveLength(0);
  });

  test("fails closed when Workers AI fails or returns no translated text", async () => {
    const body = { text: "hello", source_language: "en", target_language: "es" };

    const failed = await worker.fetch(translateRequest(body), {
      AI: fakeAi(() => {
        throw new Error("provider unavailable");
      }),
      TRANSLATIONS_TOKEN: TOKEN,
    });
    expect(failed.status).toBe(502);

    const malformed = await worker.fetch(translateRequest(body), {
      AI: fakeAi({}),
      TRANSLATIONS_TOKEN: TOKEN,
    });
    expect(malformed.status).toBe(502);
  });
});

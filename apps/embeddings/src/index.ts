/**
 * Kyomi embeddings Worker: a `POST /embed` endpoint backed by Workers AI
 * BGE-M3. The article category classifier (packages/worker) calls it through the API's
 * CLOUDFLARE_EMBEDDINGS_URL and CLOUDFLARE_EMBEDDINGS_TOKEN.
 *
 * Contract (covered by tests/api/integration/cloudflare/embed.test.ts):
 * - `Authorization: Bearer <EMBEDDINGS_TOKEN>` is required. Without the secret the Worker refuses
 *   every request instead of accepting a guessable header.
 * - The body is `{ input: string | string[] }` with at most MAX_INPUTS_PER_REQUEST strings.
 * - The response is `{ data: [{ embedding, index }] }` with exactly one entry per input, in input
 *   order. Any provider failure, including a short result, fails the whole request with 502.
 *
 * It also serves `POST /chat` for the article translation eval (scripts/evals/translation), with
 * the same bearer token (covered by tests/api/integration/cloudflare/chat.test.ts):
 * - The body is `{ model, messages, max_tokens, reasoning_effort?, response_format? }`; `model`
 *   must be in CHAT_MODELS and `max_tokens` at most MAX_CHAT_OUTPUT_TOKENS.
 * - The response is `{ model, text, finish_reason, usage: { input_tokens, output_tokens } }`,
 *   normalized from whichever output shape the model returns. A provider failure, or a result
 *   with no text, is a 502.
 *
 * Local development: `bunx wrangler dev`. Deploy: `bunx wrangler deploy`, after setting the token
 * with `bunx wrangler secret put EMBEDDINGS_TOKEN`.
 */

type Env = {
  AI: {
    run(model: string, input: Record<string, unknown>): Promise<unknown>;
  };
  EMBEDDINGS_TOKEN?: string;
};

// Allowlisted so a leaked token cannot run arbitrary (or arbitrarily priced) models.
const CHAT_MODELS = new Set(["@cf/openai/gpt-oss-120b", "@cf/deepseek-ai/deepseek-v4-pro-0813"]);
const MAX_CHAT_OUTPUT_TOKENS = 32_768;
const MAX_CHAT_INPUT_CHARS = 400_000;

const EMBEDDING_MODEL = "@cf/baai/bge-m3";
const MAX_CHARS_PER_INPUT = 6_000;
const MAX_INPUTS_PER_BATCH = 8;
// Workers AI calls in flight at once for one request.
const MAX_CONCURRENT_BATCHES = 4;
// The embeddings client sends at most 128 inputs per request; this bounds anything else.
const MAX_INPUTS_PER_REQUEST = 512;

const encoder = new TextEncoder();

function capText(text: string): string {
  if (text.length <= MAX_CHARS_PER_INPUT) {
    return text;
  }

  return `${text.slice(0, 4_500)}\n\n[truncated]\n\n${text.slice(-1_500)}`;
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

// Compares fixed-length digests, so timing reveals neither the token's length nor a shared prefix.
async function tokenMatches(provided: string, expected: string): Promise<boolean> {
  const [actual, wanted] = await Promise.all([sha256(provided), sha256(expected)]);
  let difference = 0;
  for (let index = 0; index < wanted.length; index += 1) {
    difference |= actual[index]! ^ wanted[index]!;
  }
  return difference === 0;
}

function inputTexts(body: unknown): string[] | null {
  const input =
    typeof body === "object" && body !== null ? (body as { input?: unknown }).input : undefined;
  if (typeof input === "string") {
    return [input];
  }
  if (
    Array.isArray(input) &&
    input.length > 0 &&
    input.every((value) => typeof value === "string")
  ) {
    return input;
  }
  return null;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  max_tokens: number;
  reasoning_effort?: string;
  response_format?: Record<string, unknown>;
};

function chatRequest(body: unknown): ChatRequest | string {
  if (typeof body !== "object" || body === null) {
    return "Body must be a JSON object";
  }
  const { model, messages, max_tokens, reasoning_effort, response_format } = body as Record<
    string,
    unknown
  >;
  if (typeof model !== "string" || !CHAT_MODELS.has(model)) {
    return `\`model\` must be one of ${[...CHAT_MODELS].join(", ")}`;
  }
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    !messages.every(
      (message) =>
        typeof message === "object" &&
        message !== null &&
        ["system", "user", "assistant"].includes((message as ChatMessage).role) &&
        typeof (message as ChatMessage).content === "string",
    )
  ) {
    return "`messages` must be a non-empty array of { role, content } strings";
  }
  const inputChars = (messages as ChatMessage[]).reduce((sum, m) => sum + m.content.length, 0);
  if (inputChars > MAX_CHAT_INPUT_CHARS) {
    return `\`messages\` must total at most ${MAX_CHAT_INPUT_CHARS} characters`;
  }
  if (
    typeof max_tokens !== "number" ||
    !Number.isInteger(max_tokens) ||
    max_tokens < 1 ||
    max_tokens > MAX_CHAT_OUTPUT_TOKENS
  ) {
    return `\`max_tokens\` must be an integer from 1 to ${MAX_CHAT_OUTPUT_TOKENS}`;
  }
  if (reasoning_effort !== undefined && typeof reasoning_effort !== "string") {
    return "`reasoning_effort` must be a string";
  }
  if (
    response_format !== undefined &&
    (typeof response_format !== "object" || response_format === null)
  ) {
    return "`response_format` must be an object";
  }
  return {
    model,
    messages: messages as ChatMessage[],
    max_tokens,
    ...(reasoning_effort === undefined ? {} : { reasoning_effort }),
    ...(response_format === undefined
      ? {}
      : { response_format: response_format as Record<string, unknown> }),
  };
}

// Workers AI models answer in one of three shapes: OpenAI chat completions (`choices`), the
// Responses API (`output` items), or the legacy `{ response }`. JSON mode may return an object.
type ChatResult = {
  choices?: { message?: { content?: unknown }; finish_reason?: string }[];
  output?: { type?: string; content?: { type?: string; text?: string }[] }[];
  response?: unknown;
  status?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
};

function chatText(result: ChatResult): string | null {
  const content =
    result.choices?.[0]?.message?.content ??
    result.output
      ?.filter((item) => item?.type === "message")
      .flatMap((item) => item.content ?? [])
      .filter((part) => part.type === "output_text")
      .map((part) => part.text ?? "")
      .join("") ??
    result.response;
  if (typeof content === "string") {
    return content === "" ? null : content;
  }
  return content !== null && typeof content === "object" ? JSON.stringify(content) : null;
}

async function handleChat(body: unknown, env: Env): Promise<Response> {
  const parsed = chatRequest(body);
  if (typeof parsed === "string") {
    return Response.json({ error: parsed }, { status: 400 });
  }

  const { model, ...input } = parsed;
  let result: ChatResult;
  try {
    result = ((await env.AI.run(model, input)) ?? {}) as ChatResult;
  } catch (error) {
    console.error("Workers AI chat failed", error);
    const detail = error instanceof Error ? error.message.slice(0, 500) : "unknown error";
    return Response.json({ error: "Chat provider failed", detail }, { status: 502 });
  }

  const text = chatText(result);
  if (text === null) {
    console.error("Workers AI chat returned no text", Object.keys(result));
    return Response.json(
      { error: "Chat provider returned no text", keys: Object.keys(result) },
      { status: 502 },
    );
  }

  const usage = result.usage ?? {};
  return Response.json({
    model,
    text,
    finish_reason: result.choices?.[0]?.finish_reason ?? result.status ?? null,
    usage: {
      input_tokens: usage.prompt_tokens ?? usage.input_tokens ?? null,
      output_tokens: usage.completion_tokens ?? usage.output_tokens ?? null,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true });
    }

    if (request.method !== "POST" || (url.pathname !== "/embed" && url.pathname !== "/chat")) {
      return new Response("Not found", { status: 404 });
    }

    if (!env.EMBEDDINGS_TOKEN) {
      console.error("EMBEDDINGS_TOKEN is not set; refusing embedding requests");
      return Response.json({ error: "Embeddings Worker is not configured" }, { status: 500 });
    }

    const token = bearerToken(request);
    if (token === null || !(await tokenMatches(token, env.EMBEDDINGS_TOKEN))) {
      return new Response("Unauthorized", { status: 401 });
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (url.pathname === "/chat") {
      return handleChat(body, env);
    }

    const texts = inputTexts(body);

    if (!texts) {
      return Response.json(
        { error: "`input` must be a string or a non-empty array of strings" },
        { status: 400 },
      );
    }

    if (texts.length > MAX_INPUTS_PER_REQUEST) {
      return Response.json(
        { error: `\`input\` must contain at most ${MAX_INPUTS_PER_REQUEST} strings` },
        { status: 413 },
      );
    }

    const cappedTexts = texts.map(capText);
    const data: Array<{ embedding: number[]; index: number }> = [];

    async function embedBatch(start: number): Promise<void> {
      const batch = cappedTexts.slice(start, start + MAX_INPUTS_PER_BATCH);

      const result = (await env.AI.run(EMBEDDING_MODEL, {
        text: batch,
      })) as { data?: unknown };
      const embeddings = result.data;

      // A short or malformed result would shift every later vector onto the wrong input.
      if (
        !Array.isArray(embeddings) ||
        embeddings.length !== batch.length ||
        !embeddings.every((embedding) => Array.isArray(embedding))
      ) {
        throw new Error(
          `Workers AI returned ${Array.isArray(embeddings) ? embeddings.length : "no"} embeddings for ${batch.length} inputs`,
        );
      }

      embeddings.forEach((embedding: number[], index) => {
        data[start + index] = {
          embedding,
          index: start + index,
        };
      });
    }

    try {
      const batchStarts = Array.from(
        { length: Math.ceil(cappedTexts.length / MAX_INPUTS_PER_BATCH) },
        (_, batchIndex) => batchIndex * MAX_INPUTS_PER_BATCH,
      );
      for (let next = 0; next < batchStarts.length; next += MAX_CONCURRENT_BATCHES) {
        await Promise.all(batchStarts.slice(next, next + MAX_CONCURRENT_BATCHES).map(embedBatch));
      }
    } catch (error) {
      console.error("Workers AI embedding failed", error);
      return Response.json({ error: "Embedding provider failed" }, { status: 502 });
    }

    // One `{ embedding, index }` entry per input, the shape @kyomi/worker's client reads.
    return Response.json({ data });
  },
};

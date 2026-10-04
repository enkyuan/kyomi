/**
 * Kyomi embeddings Worker: a Voyage-compatible `POST /embed` endpoint backed by Workers AI
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
 * Local development: `bunx wrangler dev`. Deploy: `bunx wrangler deploy`, after setting the token
 * with `bunx wrangler secret put EMBEDDINGS_TOKEN`.
 */

type Env = {
  AI: {
    run: (model: string, input: { text: string[] }) => Promise<{ data?: unknown }>;
  };
  EMBEDDINGS_TOKEN?: string;
};

const EMBEDDING_MODEL = "@cf/baai/bge-m3";
const MAX_CHARS_PER_INPUT = 6_000;
const MAX_INPUTS_PER_BATCH = 8;
// Feed refresh sends every parsed item in one request, and the feed parser keeps at most 500.
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true });
    }

    if (request.method !== "POST" || url.pathname !== "/embed") {
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

    try {
      for (let start = 0; start < cappedTexts.length; start += MAX_INPUTS_PER_BATCH) {
        const batch = cappedTexts.slice(start, start + MAX_INPUTS_PER_BATCH);

        const result = await env.AI.run(EMBEDDING_MODEL, {
          text: batch,
        });
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
          data.push({
            embedding,
            index: start + index,
          });
        });
      }
    } catch (error) {
      console.error("Workers AI embedding failed", error);
      return Response.json({ error: "Embedding provider failed" }, { status: 502 });
    }

    // This matches the response shape Kyomi already expects from Voyage.
    return Response.json({ data });
  },
};

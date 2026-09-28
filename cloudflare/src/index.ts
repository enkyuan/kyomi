/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

type Env = {
  AI: {
    run: (model: string, input: { text: string[] }) => Promise<{ data: number[][] }>;
  };
  EMBEDDINGS_TOKEN: string;
};

const MAX_CHARS_PER_INPUT = 6_000;
const MAX_INPUTS_PER_BATCH = 8;

function capText(text: string): string {
  if (text.length <= MAX_CHARS_PER_INPUT) {
    return text;
  }

  return `${text.slice(0, 4_500)}\n\n[truncated]\n\n${text.slice(-1_500)}`;
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

    const authorization = request.headers.get("Authorization");
    if (authorization !== `Bearer ${env.EMBEDDINGS_TOKEN}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    let body: { input?: unknown };

    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const texts =
      typeof body.input === "string"
        ? [body.input]
        : Array.isArray(body.input) && body.input.every((value) => typeof value === "string")
          ? body.input
          : null;

    if (!texts || texts.length === 0) {
      return Response.json(
        { error: "`input` must be a string or a non-empty array of strings" },
        { status: 400 },
      );
    }

    const cappedTexts = texts.map(capText);
    const data: Array<{ embedding: number[]; index: number }> = [];

    try {
      for (let start = 0; start < cappedTexts.length; start += MAX_INPUTS_PER_BATCH) {
        const batch = cappedTexts.slice(start, start + MAX_INPUTS_PER_BATCH);

        const result = await env.AI.run("@cf/baai/bge-m3", {
          text: batch,
        });

        result.data.forEach((embedding, index) => {
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

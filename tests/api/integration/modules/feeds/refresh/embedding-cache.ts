import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { CATEGORY_CARDS_VERSION, EMBEDDING_CLASSIFIER_MODEL_ID } from "@kyomi/worker";

/**
 * Offline embeddings for the live classifier evals. Vectors are stored under the gitignored
 * `.artifacts/embeddings/<model>/<CATEGORY_CARDS_VERSION>/`, keyed by a hash of the exact text the
 * classifier sent, so sweeps and evals re-run without calling the provider. A card revision gets
 * a fresh directory because its prototype texts change.
 */

const REPO_ROOT = resolve(import.meta.dir, "../../../../../..");
const UPSTREAM_BATCH_SIZE = 64;

type EmbeddingsCacheFile = Record<string, string>;

export type EmbeddingsUpstream = { url: string; token: string };

function textKey(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function encodeVector(vector: readonly number[]): string {
  return Buffer.from(new Float32Array(vector).buffer).toString("base64");
}

function decodeVector(encoded: string): number[] {
  const bytes = Buffer.from(encoded, "base64");
  return Array.from(new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4));
}

export function embeddingsCacheFile(name: string): string {
  const modelDir = EMBEDDING_CLASSIFIER_MODEL_ID.replace(/[^a-z0-9.-]+/gi, "_");
  return join(
    REPO_ROOT,
    ".artifacts",
    "embeddings",
    modelDir,
    CATEGORY_CARDS_VERSION,
    `${name}.json`,
  );
}

/**
 * The Cloudflare Worker credentials when they are usable: a dotenvx-encrypted value loaded without
 * its private key counts as absent.
 */
export function embeddingsUpstreamFromEnv(): EmbeddingsUpstream | undefined {
  const url = process.env.CLOUDFLARE_EMBEDDINGS_URL?.trim();
  const token = process.env.CLOUDFLARE_EMBEDDINGS_TOKEN?.trim();
  if (!url || !token || url.startsWith("encrypted:") || token.startsWith("encrypted:")) {
    return undefined;
  }
  return { url, token };
}

/**
 * A `fetch` stand-in for the embeddings endpoint: serves cached vectors and sends only the texts
 * it hasn't seen to `upstream`, then saves them. Without an upstream a cache miss throws.
 */
export function cachedEmbeddingsFetch(options: {
  cacheFile: string;
  upstream?: EmbeddingsUpstream;
  realFetch?: typeof fetch;
}): typeof fetch {
  const realFetch = options.realFetch ?? globalThis.fetch;
  const cache: EmbeddingsCacheFile = existsSync(options.cacheFile)
    ? (JSON.parse(readFileSync(options.cacheFile, "utf8")) as EmbeddingsCacheFile)
    : {};

  async function fillMisses(texts: readonly string[]): Promise<void> {
    const misses = [...new Set(texts.filter((text) => !(textKey(text) in cache)))];
    if (misses.length === 0) {
      return;
    }
    if (!options.upstream) {
      throw new Error(
        `${misses.length} texts are missing from ${options.cacheFile}; set CLOUDFLARE_EMBEDDINGS_URL and CLOUDFLARE_EMBEDDINGS_TOKEN to fill the cache`,
      );
    }
    // One batch at a time on purpose: the Worker already fans each request out to Workers AI,
    // and a cache fill is a one-off that shouldn't flood a shared free-tier deployment.
    for (let start = 0; start < misses.length; start += UPSTREAM_BATCH_SIZE) {
      const batch = misses.slice(start, start + UPSTREAM_BATCH_SIZE);
      // oxlint-disable-next-line react-doctor/async-await-in-loop -- sequential by design, see above
      const response = await realFetch(options.upstream.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.upstream.token}`,
        },
        body: JSON.stringify({ input: batch }),
      });
      if (!response.ok) {
        throw new Error(`Embeddings upstream failed (${response.status})`);
      }
      const payload = (await response.json()) as {
        data: Array<{ embedding: number[]; index: number }>;
      };
      for (const entry of payload.data) {
        cache[textKey(batch[entry.index]!)] = encodeVector(entry.embedding);
      }
    }
    mkdirSync(dirname(options.cacheFile), { recursive: true });
    writeFileSync(options.cacheFile, JSON.stringify(cache));
  }

  return (async (_input: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { input?: string | string[] };
    const texts = typeof body.input === "string" ? [body.input] : (body.input ?? []);
    await fillMisses(texts);
    return Response.json({
      data: texts.map((text, index) => ({ embedding: decodeVector(cache[textKey(text)]!), index })),
    });
  }) as unknown as typeof fetch;
}

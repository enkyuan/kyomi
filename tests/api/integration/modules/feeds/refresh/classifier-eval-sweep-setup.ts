import { readFileSync } from "node:fs";
import type { CategorySelectionRule, EmbeddingClassifierConfig } from "@kyomi/worker";
import { embeddingsUpstreamFromEnv } from "./embedding-cache";

/** Shared setup for the opt-in (`CLASSIFIER_SWEEP=1`) article and feed rule sweeps. */

export const SWEEP_ENABLED = process.env.CLASSIFIER_SWEEP === "1";
export const sweepUpstream = embeddingsUpstreamFromEnv();
export const sweepConfig: EmbeddingClassifierConfig = {
  apiKey: sweepUpstream?.token ?? "embeddings-cache",
  apiUrl: sweepUpstream?.url ?? "https://embeddings-cache.invalid/embed",
};

export function readJsonl<T>(path: string): T[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export function describeRule(rule: CategorySelectionRule): string {
  return `floor ${rule.minSimilarity.toFixed(2)} margin ${rule.secondaryMargin?.toFixed(2) ?? "none"}`;
}

/**
 * Embeds feed texts in one batched call first, so scoring feeds one at a time reads the cache
 * instead of sending one request per feed. Mirrors the classifier's title-and-description text.
 */
export async function prewarmFeedTexts(
  feeds: ReadonlyArray<{ feedTitle: string; feedDescription: string | null }>,
): Promise<void> {
  const texts = feeds.map((feed) =>
    [feed.feedTitle, feed.feedDescription].filter(Boolean).join(". "),
  );
  await globalThis.fetch(sweepConfig.apiUrl, {
    method: "POST",
    body: JSON.stringify({ input: texts.filter(Boolean) }),
  });
}

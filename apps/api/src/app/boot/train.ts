import { pool } from "@adapters/db/client";
import { assertApiDatabaseReady } from "@adapters/db/preflight";
import { embeddingClassifierConfig } from "@config/embeddings";
import {
  buildCategoryModel,
  CATEGORY_MODEL_LABELS,
  CATEGORY_MODEL_TRAINING_OPTIONS,
} from "@modules/catalog/category-model/build";

const version = process.argv[process.argv.indexOf("--version") + 1];
if (!process.argv.includes("--version") || !version) {
  throw new Error("Pass --version <name>, e.g. --version article-head-v2");
}
const config = embeddingClassifierConfig(60_000);
if (!config) {
  throw new Error("CLOUDFLARE_EMBEDDINGS_URL and CLOUDFLARE_EMBEDDINGS_TOKEN are required");
}

try {
  await assertApiDatabaseReady({ commandName: "category:train", ensureSchema: false });
  const { examples, report } = await buildCategoryModel({
    config,
    labels: CATEGORY_MODEL_LABELS,
    version,
    options: CATEGORY_MODEL_TRAINING_OPTIONS,
  });
  const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
  console.log(
    `5-fold cross-validation by feed: top-1 ${percent(report.top1)}, ${percent(report.clearTop1)} on labels not flagged for review`,
  );
  console.log("Best article rules (out-of-fold micro F1):");
  for (const score of report.rules.slice(0, 8)) {
    console.log(
      `  min ${score.rule.minSimilarity.toFixed(2)} margin ${score.rule.secondaryMargin?.toFixed(2) ?? "none"}: F1 ${percent(score.f1)}, precision ${percent(score.precision)}, recall ${percent(score.recall)}, abstain ${percent(score.abstention)}, two labels ${percent(score.twoLabelShare)}`,
    );
  }
  console.log(
    `Trained ${version} on ${examples} labeled articles; wrote packages/worker/src/services/feed/category-model-weights.ts`,
  );
} finally {
  await pool.end();
}

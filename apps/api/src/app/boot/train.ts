import { Console, Effect } from "effect";
import { embeddingClassifierConfig } from "@config/embeddings";
import { AppConfig } from "@config/env/service";
import {
  buildCategoryModel,
  CATEGORY_MODEL_LABELS,
  CATEGORY_MODEL_TRAINING_OPTIONS,
} from "@modules/catalog/category-model/build";
import { Embeddings } from "@modules/catalog/embeddings";
import { EmbeddingsNotConfigured, InvalidArguments } from "@modules/catalog/errors";
import { AppLive } from "../runtime";
import { runMain } from "../setup/main";
import { ensureDatabaseReady } from "../setup/ready";

const EMBEDDING_TIMEOUT_MS = 60_000;

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

const train = Effect.gen(function* () {
  const versionIndex = process.argv.indexOf("--version");
  const version = process.argv[versionIndex + 1];
  if (versionIndex === -1 || !version) {
    return yield* new InvalidArguments({
      message: "Pass --version <name>, e.g. --version article-head-v2",
    });
  }
  const config = embeddingClassifierConfig(EMBEDDING_TIMEOUT_MS, yield* AppConfig);
  if (!config) {
    return yield* new EmbeddingsNotConfigured({
      message: "CLOUDFLARE_EMBEDDINGS_URL and CLOUDFLARE_EMBEDDINGS_TOKEN are required",
    });
  }

  yield* ensureDatabaseReady({ commandName: "category:train", ensureSchema: false });
  const { examples, report } = yield* buildCategoryModel({
    config,
    labels: CATEGORY_MODEL_LABELS,
    version,
    options: CATEGORY_MODEL_TRAINING_OPTIONS,
  });
  yield* Console.log(
    `5-fold cross-validation by feed: top-1 ${percent(report.top1)}, ${percent(report.clearTop1)} on labels not flagged for review`,
  );
  yield* Console.log("Best article rules (out-of-fold micro F1):");
  for (const score of report.rules.slice(0, 8)) {
    yield* Console.log(
      `  min ${score.rule.minSimilarity.toFixed(2)} margin ${score.rule.secondaryMargin?.toFixed(2) ?? "none"}: F1 ${percent(score.f1)}, precision ${percent(score.precision)}, recall ${percent(score.recall)}, abstain ${percent(score.abstention)}, two labels ${percent(score.twoLabelShare)}`,
    );
  }
  yield* Console.log(
    `Trained ${version} on ${examples} labeled articles; wrote packages/ingest/src/services/feed/category-model-weights.ts`,
  );
});

// The layer scope closes Postgres and Redis once the run ends, or on SIGINT/SIGTERM.
runMain(train.pipe(Effect.provide(Embeddings.layer), Effect.provide(AppLive)));

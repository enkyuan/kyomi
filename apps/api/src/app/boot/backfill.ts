import { Console, Effect } from "effect";
import { summarizeBackfill, parseBackfillArgs } from "@modules/catalog/backfill/cli";
import { runCategoryBackfill } from "@modules/catalog/backfill/operations";
import { Embeddings } from "@modules/catalog/embeddings";
import { AppLive } from "../runtime";
import { runMain } from "../setup/main";
import { ensureDatabaseReady } from "../setup/ready";

const backfill = Effect.gen(function* () {
  const args = yield* parseBackfillArgs(process.argv);
  yield* ensureDatabaseReady({ commandName: "categories:backfill", ensureSchema: true });
  const stats = yield* runCategoryBackfill(args);
  yield* Console.log(summarizeBackfill(stats));
});

// The layer scope closes Postgres and Redis once the run ends, or on SIGINT/SIGTERM.
runMain(backfill.pipe(Effect.provide(Embeddings.layer), Effect.provide(AppLive)));

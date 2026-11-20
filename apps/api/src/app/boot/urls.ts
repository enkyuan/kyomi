import { Console, Effect } from "effect";
import { InvalidArguments } from "@modules/catalog/errors";
import {
  formatUrlRepairReport,
  repairStoredUrls,
  type UrlRepairOptions,
} from "@modules/feeds/repair/operations";
import { positiveIntFlag } from "@shared/cli/args";
import { AppLive } from "../runtime";
import { runMain } from "../setup/main";
import { ensureDatabaseReady } from "../setup/ready";

const MAX_BATCH_SIZE = 500;

/** Dry run unless `--apply` is present; a misspelt flag therefore never writes. */
export function parseUrlRepairArgs(argv: readonly string[]): UrlRepairOptions {
  const batchSize = positiveIntFlag(argv, "--batch-size", 100);
  if (batchSize > MAX_BATCH_SIZE) {
    throw new Error(`Invalid --batch-size value: ${batchSize} (expected 1..${MAX_BATCH_SIZE})`);
  }
  return {
    apply: argv.includes("--apply"),
    batchSize,
    sleepMs: positiveIntFlag(argv, "--sleep-ms", 100),
  };
}

const repair = Effect.gen(function* () {
  const options = yield* Effect.try({
    try: () => parseUrlRepairArgs(process.argv),
    catch: (cause) =>
      new InvalidArguments({ message: cause instanceof Error ? cause.message : String(cause) }),
  });
  yield* ensureDatabaseReady({ commandName: "content:urls-repair" });
  const report = yield* repairStoredUrls(options);
  for (const line of formatUrlRepairReport(report)) {
    yield* Console.log(line);
  }
});

// The layer scope closes Postgres and Redis once the run ends, or on SIGINT/SIGTERM.
if (import.meta.main) {
  runMain(repair.pipe(Effect.provide(AppLive)));
}

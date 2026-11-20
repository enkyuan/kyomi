import { Console, Effect } from "effect";
import { parseCatalogImportArgs } from "@modules/catalog/import/cli";
import { importCatalogFile } from "@modules/catalog/import/operations";
import { AppLive } from "../runtime";
import { runMain } from "../setup/main";
import { ensureDatabaseReady } from "../setup/ready";

const catalogImport = Effect.gen(function* () {
  const { input, dryRun, batchSize } = yield* parseCatalogImportArgs(process.argv);
  if (!dryRun) {
    yield* ensureDatabaseReady({ commandName: "catalog:import", ensureSchema: true });
  }
  const { stats, validation, duplicateCanonicalUrls } = yield* importCatalogFile(input, dryRun, {
    batchSize,
  });
  yield* Console.log(
    JSON.stringify(
      { input, dryRun, batchSize, ...stats, duplicateCanonicalUrls, validation },
      null,
      2,
    ),
  );
});

// The layer scope closes Postgres and Redis once the run ends, or on SIGINT/SIGTERM.
runMain(catalogImport.pipe(Effect.provide(AppLive)));

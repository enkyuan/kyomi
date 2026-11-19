import { Effect } from "effect";
import { developmentSchemaReady } from "@adapters/db/guard";
import { importDispatcherLoop } from "../jobs/dispatcher";
import { assetExpiryLoop } from "../jobs/asset-expiry";
import { catalogRetentionLoop } from "../jobs/catalog-retention";
import { feedRefreshSchedulerLoop } from "../jobs/scheduler";
import { AppLive } from "../runtime";
import { runMain } from "../setup/main";

// All loops run until the process is told to stop; if one of them dies the other is interrupted
// and the process exits non-zero instead of limping on with half a scheduler.
const scheduler = Effect.gen(function* () {
  yield* developmentSchemaReady;
  yield* Effect.all(
    [feedRefreshSchedulerLoop, importDispatcherLoop, catalogRetentionLoop, assetExpiryLoop],
    {
      concurrency: "unbounded",
      discard: true,
    },
  );
}).pipe(Effect.provide(AppLive));

runMain(scheduler);

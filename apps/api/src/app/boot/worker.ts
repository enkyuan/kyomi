import { Layer } from "effect";
import { WorkerLive } from "../jobs/consumer";
import { AppLive } from "../runtime";
import { runMain } from "../setup/main";

// Stops on SIGINT/SIGTERM: consumers drain, then Redis and Postgres close, then the process exits.
runMain(Layer.launch(WorkerLive.pipe(Layer.provide(AppLive))));

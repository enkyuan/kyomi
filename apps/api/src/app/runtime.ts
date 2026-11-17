import { Layer, ManagedRuntime } from "effect";
import { Db } from "@adapters/db/service";
import { HttpClientLive } from "@adapters/http/client";
import { AppLogger } from "@adapters/logger/service";
import { Redis } from "@adapters/redis/service";
import { AppConfig } from "@config/env/service";

const ConfigAndLogger = Layer.mergeAll(
  AppConfig.layer,
  AppLogger.layer.pipe(Layer.provide(AppConfig.layer)),
);

/** Every service the API provides, wired once. Resources release when the runtime is disposed. */
export const AppLive = Layer.mergeAll(Db.layer, Redis.layer, HttpClientLive).pipe(
  Layer.provideMerge(ConfigAndLogger),
);

export type AppServices = Layer.Success<typeof AppLive>;
export type AppRuntime = ManagedRuntime.ManagedRuntime<AppServices, Layer.Error<typeof AppLive>>;

/** One runtime per process (or per test app). Dispose it to release the pool and Redis. */
export function createAppRuntime(): AppRuntime {
  return ManagedRuntime.make(AppLive);
}

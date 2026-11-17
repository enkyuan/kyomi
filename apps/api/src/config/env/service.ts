import { Context, Effect, Layer } from "effect";
import { ConfigError } from "@shared/effect/errors";
import { loadEnv, type Env } from "./runtime";

type RawEnv = Record<string, string | undefined>;

/**
 * The validated process environment as a service. Building the layer validates, so a bad
 * environment fails when the runtime is built at boot instead of on first use.
 */
export class AppConfig extends Context.Service<AppConfig, Env>()("kyomi/AppConfig") {
  /** Validate `source` (default `process.env`) and fail with `ConfigError` when it is invalid. */
  static layerFrom = (source: RawEnv = process.env) =>
    Layer.effect(
      AppConfig,
      Effect.try({
        try: () => AppConfig.of(loadEnv(source)),
        catch: (cause) => new ConfigError({ message: "Invalid environment variables", cause }),
      }),
    );

  static readonly layer = AppConfig.layerFrom();

  /** A fixed config for tests; no validation, no process environment. */
  static layerOf = (env: Env) => Layer.succeed(AppConfig, AppConfig.of(env));
}

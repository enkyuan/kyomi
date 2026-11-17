import type { ManagedRuntime } from "effect";
import type { HttpClient } from "effect/http";
import type { Db } from "@adapters/db/service";
import type { AppLogger } from "@adapters/logger/service";
import type { JobQueue } from "@adapters/queue/service";
import type { FeedSearch } from "@adapters/search/service";
import type { AppConfig } from "@config/env/service";
import type { FeedBackground } from "./service";

/** The services the feed routes run against; `AppRuntime` provides all of them. */
export type FeedsServices =
  | Db
  | AppLogger
  | AppConfig
  | JobQueue
  | FeedSearch
  | HttpClient.HttpClient
  | FeedBackground;

export type FeedsRuntime = ManagedRuntime.ManagedRuntime<FeedsServices, unknown>;

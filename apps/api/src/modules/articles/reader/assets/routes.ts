import { Elysia } from "elysia";
import type { ManagedRuntime } from "effect";
import type { HttpClient } from "effect/http";
import type { AppLogger } from "@adapters/logger/service";
import type { AppConfig } from "@config/env/service";
import { effectPlugin } from "@shared/http/effect/plugin";
import { requestObservationPlugin } from "@shared/http/stacks";
import { serveReaderImage } from "./handler";

type ReaderAssetRuntime = ManagedRuntime.ManagedRuntime<
  AppLogger | HttpClient.HttpClient | AppConfig,
  unknown
>;

/** Public, bounded image transport for reader documents rendered in Expo DOM. */
export function readerAssetPlugin(runtime: ReaderAssetRuntime) {
  return new Elysia({ name: "kyomi.reader.assets" })
    .use(requestObservationPlugin(runtime))
    .use(effectPlugin(runtime))
    .get("/api/reader-image", ({ request, runEffect }) => runEffect(serveReaderImage(request.url)));
}

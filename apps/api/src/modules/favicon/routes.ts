import { Elysia } from "elysia";
import type { ManagedRuntime } from "effect";
import type { Db } from "@adapters/db/service";
import type { AppConfig } from "@config/env/service";
import { effectPlugin } from "@shared/http/effect/plugin";
import { requestObservationPlugin } from "@shared/http/stacks";
import { handleFaviconRequest } from "./handler";
import type { FaviconResolver } from "./service";

export type FaviconRuntime = ManagedRuntime.ManagedRuntime<
  Db | FaviconResolver | AppConfig,
  unknown
>;

export function faviconPlugin(runtime: FaviconRuntime) {
  return new Elysia({
    name: "kyomi.favicon",
  })
    .use(requestObservationPlugin(runtime))
    .use(effectPlugin(runtime))
    .get("/api/favicon", ({ request, runEffect }) => runEffect(handleFaviconRequest(request)));
}

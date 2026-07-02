import { Elysia } from "elysia";
import { databaseAdapterPlugin, requestObservationPlugin } from "@shared/http/stacks";
import { handleFaviconRequest } from "./service";

export const faviconPlugin = new Elysia({
  name: "kyomi.favicon",
})
  .use(requestObservationPlugin)
  .use(databaseAdapterPlugin)
  .get("/api/favicon", ({ db, request }) => handleFaviconRequest(db, request));

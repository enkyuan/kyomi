import { Elysia } from "elysia";
import { requestObservationPlugin } from "@shared/http/stacks";
import { handleReaderImageRequest } from "./handler";

/** Public, bounded image transport for reader documents rendered in Expo DOM. */
export const readerAssetPlugin = new Elysia({
  name: "kyomi.reader.assets",
})
  .use(requestObservationPlugin)
  .get("/api/reader-image", ({ request }) => handleReaderImageRequest(request));

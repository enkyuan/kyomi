import { Elysia } from "elysia";
import { SERVICE_NAME } from "@config/constants";
import { propagateOrMintRequestId } from "@shared/utils/request-id";

/** Propagates or mints `x-request-id` on the response and exposes it on the context. */
export const requestIdMiddleware = new Elysia({
  name: "request-id",
})
  .derive(({ request, set }) => {
    const requestId = propagateOrMintRequestId(request, set);
    return { requestId };
  })
  .decorate("serviceName", SERVICE_NAME);

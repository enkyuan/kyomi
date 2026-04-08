import { propagateOrMintRequestId, type MutableResponseHeaders } from "@shared/utils/request-id";
import { requireAuth } from "./auth.middleware";

/** Better Auth session: authenticated `userId` + propagated `requestId` (no org scope). */
export async function resolveSessionContext(
  request: Request,
  set: { headers: MutableResponseHeaders },
) {
  const requestId = propagateOrMintRequestId(request, set);
  const { userId } = await requireAuth(request.headers);
  return { userId, requestId };
}

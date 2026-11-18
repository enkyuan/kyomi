import { Context } from "effect";

/** Per-request facts, provided by the HTTP bridge for the duration of one `runEffect` call. */
export class RequestContext extends Context.Service<
  RequestContext,
  { readonly requestId: string; readonly method: string; readonly path: string }
>()("kyomi/RequestContext") {}

/** The authenticated user, provided only when the bridge is given a `userId`. */
export class CurrentUser extends Context.Service<CurrentUser, { readonly userId: string }>()(
  "kyomi/CurrentUser",
) {}

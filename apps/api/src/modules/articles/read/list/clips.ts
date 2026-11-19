import { Effect } from "effect";
import { Db } from "@adapters/db/service";
import { listClipsForUser, type ListClipsOptions } from "@modules/articles/write/clips/queries";

/**
 * One page of the user's clips. The query is owned by `write/clips` and is still a Promise
 * function, so this is the only place the read side crosses into it.
 */
export const listClips = Effect.fn("articles.clips.list")(function* (
  userId: string,
  opts: ListClipsOptions,
) {
  const db = yield* Db;
  return yield* db.use("articles.clips.list", (client) => listClipsForUser(client, userId, opts));
});

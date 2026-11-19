import { Effect } from "effect";
import { AppLogger } from "@adapters/logger/service";
import { JobQueue } from "@adapters/queue/service";
import { BadRequest } from "@shared/effect/errors";
import { serializeError } from "@shared/errors/serialize";
import { createOpmlImport, recordOpmlImportPrepareWakeup } from "./store";

function assertSupportedFilename(filename: string) {
  const trimmed = filename.trim();
  if (!trimmed) {
    return Effect.succeed("inline.opml");
  }
  if (!/\.(opml|xml)$/i.test(trimmed)) {
    return Effect.fail(
      new BadRequest({
        message: "Invalid file type. Please provide a .opml or .xml filename.",
        code: "OPML_FILE_TYPE_INVALID",
      }),
    );
  }
  return Effect.succeed(trimmed);
}

/**
 * Stores the source and asks for it to be prepared. A failure to publish the wakeup is logged and
 * not surfaced: the import is already durable and the scheduler's reconciler republishes it.
 */
export const enqueueOpmlImport = Effect.fn("opml.enqueue")(function* (input: {
  userId: string;
  xml: string;
  filename?: string;
  sourceUrl?: string | null;
}) {
  const queue = yield* JobQueue;
  const log = yield* AppLogger;
  const filename = yield* assertSupportedFilename(input.filename ?? "inline.opml");
  const created = yield* createOpmlImport({
    userId: input.userId,
    filename,
    sourceUrl: input.sourceUrl,
    sourceXml: input.xml,
  });

  yield* queue.publish({ type: "opml.import.prepare", payload: { importId: created.id } }).pipe(
    Effect.andThen(recordOpmlImportPrepareWakeup(created.id)),
    Effect.catch((error) =>
      log.error("opml.import.prepare.delivery_pending", {
        userId: input.userId,
        taskId: created.id,
        error: serializeError(error),
      }),
    ),
  );

  yield* log.info("opml.import.enqueued", { userId: input.userId, taskId: created.id, filename });
  return { taskId: created.id };
});

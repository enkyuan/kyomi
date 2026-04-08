/** Max OPML XML string length (UTF-16 code units, matches `String.length`). */
export const OPML_MAX_BYTES = 2 * 1024 * 1024;

/** Max distinct `xmlUrl` entries processed per import (after dedupe). */
export const OPML_MAX_OUTLINES = 150;

/** Redis TTL for import task payloads and user task index. */
export const OPML_TASK_TTL_SEC = 86_400;

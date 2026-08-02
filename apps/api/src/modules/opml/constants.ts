/** Max local/raw-XML OPML source size in bytes (UTF-8), measured with Buffer.byteLength. */
export const OPML_MAX_SOURCE_BYTES = 32 * 1024 * 1024;

/** Max OPML source size accepted through the legacy JSON-body compatibility route. */
export const OPML_LEGACY_JSON_MAX_SOURCE_BYTES = 2 * 1024 * 1024;

/** Max distinct normalized feed URLs processed per import. */
export const OPML_MAX_FEEDS = 100_000;

/** Max outline nesting depth before rejecting the document. */
export const OPML_MAX_DEPTH = 64;

/** Max accepted feed URL length in characters. */
export const OPML_MAX_URL_LENGTH = 4_096;

/** Max accepted title/folder-name length in characters. */
export const OPML_MAX_LABEL_LENGTH = 512;

/** Max rows written per chunked materialization statement. */
export const OPML_MATERIALIZE_CHUNK_SIZE = 500;

/** Days a terminal import row is retained before cleanup. */
export const OPML_IMPORT_RETENTION_DAYS = 30;

/** Max attempts for an unknown-feed import item before it is marked permanently failed. */
export const OPML_ITEM_MAX_ATTEMPTS = 5;

/** Lease duration for a claimed import item, in milliseconds. */
export const OPML_ITEM_LEASE_MS = 120_000;

/** Heartbeat interval for a claimed import item, in milliseconds. */
export const OPML_ITEM_HEARTBEAT_MS = 30_000;

/** Redis TTL for legacy import task payloads and user task index. */
export const OPML_TASK_TTL_SEC = 86_400;

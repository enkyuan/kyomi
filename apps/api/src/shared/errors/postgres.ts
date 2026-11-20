/**
 * What a failed Postgres call means for the caller. `unique_violation` is a write that lost a race
 * to an equal row, `foreign_key_violation` a write that referenced a row that is gone. The rest are
 * about the database, not the request: `serialization_failure` and `deadlock` ask for the whole
 * transaction to be run again, `timeout` is a statement the server cancelled or a client that gave
 * up waiting, and `connection` is a connection that was refused, reset or terminated.
 */
export type DatabaseFailureKind =
  | "unique_violation"
  | "foreign_key_violation"
  | "serialization_failure"
  | "deadlock"
  | "timeout"
  | "connection"
  | "other";

/** Running the same work again, soon, can succeed: the failure was the database's, not the request's. */
export function isTransientDatabaseFailure(kind: DatabaseFailureKind): boolean {
  return (
    kind === "serialization_failure" ||
    kind === "deadlock" ||
    kind === "timeout" ||
    kind === "connection"
  );
}

/** Drizzle wraps the driver's error as `cause`; the SQLSTATE can sit a few levels down. */
const MAX_CAUSE_DEPTH = 5;

/**
 * A SQLSTATE is five characters from `0-9A-Z`. Node's system errors (`EPIPE`, `ECONNRESET`) fit the
 * shape too, and none of the SQLSTATE classes starts with `E`, so those are told apart by it.
 */
function isSqlState(code: unknown): code is string {
  return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) && !code.startsWith("E");
}

function causeChain(cause: unknown): Error[] {
  const chain: Error[] = [];
  let current: unknown = cause;
  while (current instanceof Error && chain.length < MAX_CAUSE_DEPTH && !chain.includes(current)) {
    chain.push(current);
    current = current.cause;
  }
  return chain;
}

/** The SQLSTATE of the Postgres error behind `cause`, if there is one. */
export function postgresSqlState(cause: unknown): string | undefined {
  for (const error of causeChain(cause)) {
    const code = (error as { code?: unknown }).code;
    if (isSqlState(code)) {
      return code;
    }
  }
  return undefined;
}

const SYSTEM_CONNECTION_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
]);

/**
 * `pg` raises these itself, without a SQLSTATE, when its own `query_timeout` or
 * `connectionTimeoutMillis` passes or a connection drops. They are matched on the exact text `pg`
 * uses; this is the one place a message is read, because there is nothing else to go on.
 */
function classifyClientError(error: Error): DatabaseFailureKind | undefined {
  const { message } = error;
  if (message === "Query read timeout" || message === "timeout exceeded when trying to connect") {
    return "timeout";
  }
  if (
    message.startsWith("Connection terminated") ||
    message === "Client has encountered a connection error and is not queryable" ||
    SYSTEM_CONNECTION_CODES.has((error as { code?: string }).code ?? "")
  ) {
    return "connection";
  }
  return undefined;
}

function classifySqlState(sqlState: string): DatabaseFailureKind {
  switch (sqlState) {
    case "23505":
      return "unique_violation";
    case "23503":
      return "foreign_key_violation";
    case "40001":
      return "serialization_failure";
    case "40P01":
      return "deadlock";
    case "57014":
      return "timeout";
    // Administrator shutdown, crash shutdown and cannot-connect-now, and too many connections.
    case "57P01":
    case "57P02":
    case "57P03":
    case "53300":
      return "connection";
    default:
      return sqlState.startsWith("08") ? "connection" : "other";
  }
}

/** Classify what a Postgres call threw, by SQLSTATE where the driver gave one. */
export function classifyDatabaseCause(cause: unknown): DatabaseFailureKind {
  const sqlState = postgresSqlState(cause);
  if (sqlState !== undefined) {
    return classifySqlState(sqlState);
  }
  for (const error of causeChain(cause)) {
    const kind = classifyClientError(error);
    if (kind !== undefined) {
      return kind;
    }
  }
  return "other";
}

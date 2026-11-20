import { describe, expect, test } from "bun:test";
import { DatabaseError } from "@shared/effect/errors";
import {
  classifyDatabaseCause,
  isTransientDatabaseFailure,
  postgresSqlState,
  type DatabaseFailureKind,
} from "@shared/errors/postgres";

/** An error shaped like pg's `DatabaseError`: the SQLSTATE is its `code`. */
const pgError = (code: string, message = "boom") => Object.assign(new Error(message), { code });

/** Drizzle reports the driver's error as the `cause` of its own. */
const drizzleError = (cause: unknown) => new Error("Failed query: select 1", { cause });

describe("classifyDatabaseCause", () => {
  const cases: Array<[string, DatabaseFailureKind]> = [
    ["23505", "unique_violation"],
    ["23503", "foreign_key_violation"],
    ["40001", "serialization_failure"],
    ["40P01", "deadlock"],
    ["57014", "timeout"],
    ["57P01", "connection"],
    ["57P02", "connection"],
    ["57P03", "connection"],
    ["53300", "connection"],
    ["08006", "connection"],
    ["08001", "connection"],
    // Real failures that are not about a race or the database being away.
    ["42601", "other"],
    ["23502", "other"],
    ["22P02", "other"],
    ["53100", "other"],
  ];

  for (const [sqlState, kind] of cases) {
    test(`SQLSTATE ${sqlState} is ${kind}, direct or wrapped by Drizzle`, () => {
      expect(classifyDatabaseCause(pgError(sqlState))).toBe(kind);
      expect(classifyDatabaseCause(drizzleError(pgError(sqlState)))).toBe(kind);
    });
  }

  test("reads the SQLSTATE, never the message", () => {
    expect(
      classifyDatabaseCause(pgError("42601", "duplicate key value violates unique constraint")),
    ).toBe("other");
    expect(classifyDatabaseCause(new Error("duplicate key value violates unique constraint"))).toBe(
      "other",
    );
  });

  test("a client that gave up waiting is a timeout, with no SQLSTATE to go on", () => {
    expect(classifyDatabaseCause(new Error("Query read timeout"))).toBe("timeout");
    expect(classifyDatabaseCause(new Error("timeout exceeded when trying to connect"))).toBe(
      "timeout",
    );
    expect(classifyDatabaseCause(drizzleError(new Error("Query read timeout")))).toBe("timeout");
  });

  test("a connection that was refused, reset or terminated is a connection failure", () => {
    for (const message of [
      "Connection terminated unexpectedly",
      "Connection terminated due to connection timeout",
      "Client has encountered a connection error and is not queryable",
    ]) {
      expect(classifyDatabaseCause(new Error(message))).toBe("connection");
    }
    for (const code of ["ECONNREFUSED", "ECONNRESET", "EPIPE", "ETIMEDOUT", "ENOTFOUND"]) {
      expect(classifyDatabaseCause(pgError(code, "connect failed"))).toBe("connection");
    }
  });

  test("a system error code is not mistaken for a SQLSTATE", () => {
    expect(postgresSqlState(pgError("EPIPE"))).toBeUndefined();
    expect(postgresSqlState(pgError("ECONNRESET"))).toBeUndefined();
    expect(postgresSqlState(pgError("23505"))).toBe("23505");
  });

  test("anything else, including values that are not errors, is other", () => {
    for (const cause of [
      new Error("something broke"),
      "23505",
      { code: "23505" },
      null,
      undefined,
      42,
    ]) {
      expect(classifyDatabaseCause(cause)).toBe("other");
    }
  });

  test("finds the SQLSTATE a few levels down and stops on a cause that loops", () => {
    expect(classifyDatabaseCause(drizzleError(drizzleError(drizzleError(pgError("23505")))))).toBe(
      "unique_violation",
    );

    const loop = new Error("loop");
    loop.cause = loop;
    expect(classifyDatabaseCause(loop)).toBe("other");

    let deep: Error = pgError("23505");
    for (let i = 0; i < 10; i += 1) {
      deep = drizzleError(deep);
    }
    expect(classifyDatabaseCause(deep)).toBe("other");
  });

  test("the SQLSTATE wins over a message that looks like a client error", () => {
    expect(classifyDatabaseCause(pgError("23505", "Query read timeout"))).toBe("unique_violation");
  });
});

describe("isTransientDatabaseFailure", () => {
  test("only failures of the database, not of the request, are worth running again", () => {
    expect(
      (
        [
          "serialization_failure",
          "deadlock",
          "timeout",
          "connection",
          "unique_violation",
          "foreign_key_violation",
          "other",
        ] as const
      ).map(isTransientDatabaseFailure),
    ).toEqual([true, true, true, true, false, false, false]);
  });
});

describe("DatabaseError", () => {
  test("carries what its cause means and the SQLSTATE", () => {
    const error = new DatabaseError({
      operation: "insert subscription",
      cause: drizzleError(pgError("23505")),
    });

    expect(error.kind).toBe("unique_violation");
    expect(error.sqlState).toBe("23505");
    expect(error.message).toBe("Database operation failed: insert subscription");
  });

  test("a cause with no SQLSTATE has none and is other", () => {
    const error = new DatabaseError({ operation: "select 1", cause: new Error("boom") });

    expect(error.kind).toBe("other");
    expect(error.sqlState).toBeUndefined();
  });
});

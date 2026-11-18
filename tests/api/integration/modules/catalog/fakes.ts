import { Effect, Layer } from "effect";
import { getTableName, type Table } from "drizzle-orm";
import { Embeddings, type EmbeddingsShape } from "@modules/catalog/embeddings";
import { UpstreamError } from "@shared/effect/errors";
import { fakeDb } from "@api-tests/support/layers";

/** One statement the code under test sent to the fake database. */
export type DbCall = {
  readonly op: "select" | "insert" | "delete";
  /** The Drizzle table name (`from`, `insert`, `delete` target). */
  readonly table: string | undefined;
  /** What `values(...)` was given, for inserts. */
  readonly values: Record<string, unknown>[];
  /** The selected fields, for selects. */
  readonly fields: Record<string, unknown> | undefined;
};

type SelectRequest = Pick<DbCall, "table" | "fields">;

/**
 * A Drizzle fake that records every select, insert and delete. Each builder accepts any chained
 * method and is awaitable; selects are answered by `respond`, and an insert's `returning(...)`
 * answers with the requested columns of the inserted values (so generated ids round-trip).
 */
export function recordingDb(respond: (request: SelectRequest) => unknown[] = () => []) {
  const calls: DbCall[] = [];

  const builder = (
    call: { -readonly [K in keyof DbCall]: DbCall[K] },
    returning: () => unknown[],
  ) => {
    const proxy: object = new Proxy(
      {},
      {
        get(_target, property) {
          if (property === "then") {
            return (resolve: (rows: unknown[]) => unknown, reject?: (cause: unknown) => unknown) =>
              Promise.resolve(returning()).then(resolve, reject);
          }
          return (...args: unknown[]) => {
            if (property === "from") {
              call.table = getTableName(args[0] as Table);
            }
            if (property === "values") {
              call.values = Array.isArray(args[0]) ? args[0] : [args[0]];
            }
            if (property === "returning") {
              const fields = args[0] as Record<string, unknown> | undefined;
              returning = () =>
                call.values.map((value) =>
                  Object.fromEntries(Object.keys(fields ?? value).map((key) => [key, value[key]])),
                );
            }
            return proxy;
          };
        },
      },
    );
    return proxy;
  };

  const start = (op: DbCall["op"]) => {
    const call: { -readonly [K in keyof DbCall]: DbCall[K] } = {
      op,
      table: undefined,
      values: [],
      fields: undefined,
    };
    calls.push(call);
    return call;
  };

  const select = (fields?: Record<string, unknown>) => {
    const call = start("select");
    call.fields = fields;
    return builder(call, () => respond({ table: call.table, fields: call.fields }));
  };
  const insert = (table: Table) => {
    const call = start("insert");
    call.table = getTableName(table);
    return builder(call, () => []);
  };
  const remove = (table: Table) => {
    const call = start("delete");
    call.table = getTableName(table);
    return builder(call, () => []);
  };

  return {
    calls,
    layer: fakeDb({ select, insert, delete: remove }),
    /** The values of every insert into `table`, in call order. */
    inserted: (table: string) =>
      calls.filter((call) => call.op === "insert" && call.table === table).flatMap((c) => c.values),
    count: (op: DbCall["op"], table: string) =>
      calls.filter((call) => call.op === op && call.table === table).length,
  };
}

const failing = (operation: string) => () =>
  Effect.fail(new UpstreamError({ operation, cause: new Error("embeddings unavailable") }));

/** An `Embeddings` service answering from the given functions; unlisted calls fail upstream. */
export function fakeEmbeddings(overrides: Partial<EmbeddingsShape> = {}) {
  return Layer.succeed(
    Embeddings,
    Embeddings.of({
      classifyFeed: failing("embeddings.classifyFeed"),
      classifyItems: failing("embeddings.classifyItems"),
      embedItems: failing("embeddings.embedItems"),
      ...overrides,
    }),
  );
}

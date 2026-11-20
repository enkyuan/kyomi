import { mock } from "bun:test";
import { Database, type SQLQueryBindings } from "bun:sqlite";

// Exercise the shipping SQL and transaction boundaries using SQLite on the host.
export function mockOfflineSqlite() {
  mock.module("expo-sqlite", () => ({
    openDatabaseSync: () => {
      const db = new Database(":memory:");
      return {
        execSync: (sql: string) => db.exec(sql),
        runSync: (sql: string, ...args: SQLQueryBindings[]) => db.query(sql).run(...args),
        getFirstSync: (sql: string, ...args: SQLQueryBindings[]) => db.query(sql).get(...args),
        getAllSync: (sql: string) => db.query(sql).all(),
        withTransactionSync: (task: () => void) => db.transaction(task)(),
      };
    },
  }));
}

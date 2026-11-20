import type { SQLiteDatabase } from "expo-sqlite";
import type { ArticleDetailDto } from "@kyomi/reader/schemas/article";
import {
  needsSync,
  replay,
  type Edit,
  type OfflineArticle,
  type Library,
} from "@kyomi/reader/offline";
import { fetchMobileApiJson } from "../api";
import { createAppStorage } from "../storage";

const ownerStore = createAppStorage("session-owner");
export const offlineOwner = () => ownerStore.getString("user-id");
let connection: SQLiteDatabase | undefined;
function database() {
  if (!connection) {
    const { openDatabaseSync } = require("expo-sqlite") as typeof import("expo-sqlite");
    const db = openDatabaseSync("read-later.db");
    db.execSync(
      "PRAGMA journal_mode=WAL; PRAGMA secure_delete=ON; CREATE TABLE IF NOT EXISTS articles (id TEXT PRIMARY KEY, data TEXT NOT NULL,pending INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS pending_articles ON articles(pending) WHERE pending=1",
    );
    connection = db;
  }
  return connection;
}
export function clearOfflineLibrary() {
  database().execSync("DELETE FROM articles");
}
export const library: Library = {
  async list(owner, pendingOnly) {
    if (offlineOwner() !== owner) return [];
    return database()
      .getAllSync<{ data: string }>(
        pendingOnly ? "SELECT data FROM articles WHERE pending=1" : "SELECT data FROM articles",
      )
      .map((row) => JSON.parse(row.data) as OfflineArticle);
  },
  async edit(owner, id, edit: Edit) {
    if (!owner || offlineOwner() !== owner) throw new Error("Offline library account changed");
    const db = database();
    db.withTransactionSync(() => {
      const prev = db.getFirstSync<{ data: string }>("SELECT data FROM articles WHERE id=?", id);
      const previous: OfflineArticle | undefined = prev ? JSON.parse(prev.data) : undefined;
      const next = edit(previous);
      if (next === previous) return;
      if (next)
        db.runSync(
          "INSERT OR REPLACE INTO articles(id,data,pending) VALUES(?,?,?)",
          id,
          JSON.stringify(next),
          Number(needsSync(next)),
        );
      else db.runSync("DELETE FROM articles WHERE id=?", id);
    });
  },
};

let tail = Promise.resolve();
export function syncLibrary(owner: string) {
  const headers = { "x-kyomi-offline-owner": owner, "content-type": "application/json" };
  const path = (id: string) => "/api/v1/articles/" + encodeURIComponent(id);
  const next = tail.then(() =>
    replay(library, owner, {
      detail: (id) => fetchMobileApiJson<ArticleDetailDto>(path(id), { headers }),
      put: (id, suffix, body) =>
        fetchMobileApiJson<void>(path(id) + suffix, {
          method: "PUT",
          headers,
          body: JSON.stringify(body),
        }),
    }),
  );
  tail = next.catch(() => {});
  return next;
}

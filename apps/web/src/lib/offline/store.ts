import { needsSync } from "@kyomi/reader/offline";
import type { Edit, Library, OfflineArticle } from "@kyomi/reader/offline";

let opening: Promise<IDBDatabase> | undefined;
function database() {
  return (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("kyomi-read-later", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("account");
      req.result.createObjectStore("articles", { keyPath: "id" }).createIndex("pending", "pending");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = undefined;
      reject(req.error);
    };
  }));
}

async function transaction<T>(
  mode: IDBTransactionMode,
  run: (account: string | null, tx: IDBTransaction, done: (value: T) => void) => void,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["account", "articles"], mode);
    let result: T;
    const get = tx.objectStore("account").get("owner");
    get.onsuccess = () =>
      run(get.result ?? null, tx, (value) => {
        result = value;
      });
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error ?? new Error("Offline library account changed"));
    tx.onerror = () => reject(tx.error);
  });
}

export function owner() {
  return transaction<string | null>("readonly", (id, _tx, done) => done(id));
}
export async function adopt(id: string | null) {
  const changed = await transaction<boolean>("readwrite", (current, tx, done) => {
    if (current !== id) {
      tx.objectStore("articles").clear();
      tx.objectStore("account").put(id, "owner");
    }
    done(current !== id);
  });
  if (changed && typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("kyomi-offline-account");
    channel.postMessage("changed");
    channel.close();
  }
}

export const library: Library = {
  list: (id, pendingOnly) =>
    transaction<OfflineArticle[]>("readonly", (current, tx, done) => {
      if (current !== id) {
        done([]);
        return;
      }
      const articles = tx.objectStore("articles");
      const req = pendingOnly ? articles.index("pending").getAll(1) : articles.getAll();
      req.onsuccess = () => done(req.result);
    }),
  edit: (id, key, edit: Edit) =>
    transaction<void>("readwrite", (current, tx) => {
      if (!id || current !== id) {
        tx.abort();
        return;
      }
      const store = tx.objectStore("articles");
      const req = store.get(key);
      req.onsuccess = () => {
        const row = edit(req.result);
        if (row === req.result) return;
        if (row) store.put({ ...row, pending: Number(needsSync(row)) });
        else store.delete(key);
      };
    }),
};

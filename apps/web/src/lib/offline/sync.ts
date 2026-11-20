import { replay, type Transport } from "@kyomi/reader/offline";
import { library } from "@kyomi/reader/offline/indexeddb";

export async function syncLibrary(owner: string) {
  const request = async (id: string, path = "", body?: unknown) => {
    const res = await fetch("/api/v1/articles/" + encodeURIComponent(id) + path, {
      method: body ? "PUT" : "GET",
      cache: "no-store",
      headers: { "x-kyomi-offline-owner": owner, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok)
      throw Object.assign(new Error("Offline sync " + res.status), { status: res.status });
    return res.json();
  };
  const api: Transport = {
    detail: (id) => request(id),
    put: (id, path, body) => request(id, path, body),
  };
  return navigator.locks.request("kyomi-offline-sync", () => replay(library, owner, api));
}

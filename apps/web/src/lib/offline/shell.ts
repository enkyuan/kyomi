import { createActiveTimer, createReadingSession } from "@kyomi/reader/core";
import {
  editFlags,
  editProgress,
  pages,
  pagePosition,
  type OfflineArticle,
} from "@kyomi/reader/offline";
import { READER_PREFERENCES_STORAGE_KEY } from "../shell/keys";
import { library, owner } from "./store";
import { syncLibrary } from "./sync";

const view = document.querySelector<HTMLElement>("#view")!;
const status = document.querySelector<HTMLElement>("#status")!;
let account: string | null;
let selected: string | null = null;
let pageOverride: number | undefined;
function rememberPosition(id: string) {
  try {
    return (
      JSON.parse(localStorage.getItem(READER_PREFERENCES_STORAGE_KEY + ":" + id) ?? "{}")
        .rememberPosition !== false
    );
  } catch {
    return true;
  }
}
let session: ReturnType<typeof createReadingSession>;
let timer = createActiveTimer();
function button(label: string, action: () => Promise<void>) {
  const b = document.createElement("button");
  b.textContent = label;
  b.onclick = () => {
    b.disabled = true;
    void action()
      .catch(fail)
      .finally(() => {
        b.disabled = false;
      });
  };
  return b;
}
function fail() {
  status.textContent = "Could not access the offline library. Try again.";
}
async function sync() {
  if (!account || !navigator.onLine) return;
  try {
    await syncLibrary(account);
    status.textContent = "";
    await render();
  } catch {
    status.textContent = "Changes are on this device. Reconnect and sign in to sync.";
  }
}
async function show(row: OfflineArticle) {
  if (!account) return;
  selected = row.id;
  const id = account;
  const parts = pages(row.document?.text ?? "");
  const index =
    pageOverride ??
    (rememberPosition(id) ? Math.round(row.position * Math.max(0, parts.length - 1)) : 0);
  const heading = document.createElement("h2");
  heading.textContent = row.document?.title ?? "Saved article";
  const body = document.createElement("article");
  body.textContent = parts[index] ?? "No article text is available on this device.";
  const nav = document.createElement("nav");
  const move = async (page: number) => {
    timer.markActivity();
    session.sample({
      progress: pagePosition(page, parts.length),
      completed: page === parts.length - 1,
    });
    const update = session.takeUpdate();
    pageOverride = page;
    if (update && rememberPosition(id)) await editProgress(library, id, row.id, update);
    await render();
    void sync();
  };
  if (index > 0) nav.append(button("Previous", () => move(index - 1)));
  if (parts.length) nav.append(document.createTextNode(`Page ${index + 1} of ${parts.length} `));
  if (index + 1 < parts.length) nav.append(button("Next", () => move(index + 1)));
  view.replaceChildren(
    button("All saved articles", async () => {
      selected = null;
      await render();
    }),
    heading,
    body,
    nav,
    button(row.read ? "Mark unread" : "Mark read", async () => {
      await editFlags(library, id, row.id, { isRead: !row.read });
      await render();
      void sync();
    }),
    button("Remove from Read Later", async () => {
      await editFlags(library, id, row.id, { isSaved: false });
      selected = null;
      await render();
      void sync();
    }),
  );
}
async function render() {
  account = await owner();
  const rows = account ? (await library.list(account)).filter((r) => r.saved) : [];
  const chosen = rows.find((r) => r.id === selected);
  if (chosen) return show(chosen);
  selected = null;
  if (!rows.length) {
    view.textContent = "No articles saved on this device.";
    return;
  }
  const list = document.createElement("ul");
  for (const row of rows) {
    const li = document.createElement("li");
    li.append(
      button(row.document?.title || "Waiting for download", async () => {
        pageOverride = undefined;
        timer = createActiveTimer();
        session = createReadingSession({
          contentKey: row.document?.contentKey ?? "offline-text",
          timer,
        });
        await show(row);
      }),
    );
    list.append(li);
  }
  view.replaceChildren(list);
}
window.addEventListener("pagehide", () => view.replaceChildren());
window.addEventListener("pageshow", () => void render().catch(fail));
window.addEventListener("online", () => void sync());
document.addEventListener("visibilitychange", () => {
  timer.setVisible(!document.hidden);
  if (!document.hidden) void render().then(sync).catch(fail);
});
if (typeof BroadcastChannel !== "undefined")
  new BroadcastChannel("kyomi-offline-account").onmessage = () => {
    view.replaceChildren();
    selected = null;
    void render().catch(fail);
  };
void render().then(sync).catch(fail);

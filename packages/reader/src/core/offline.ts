import { buildContentKey } from "./progress";
import { Parser } from "htmlparser2";
import type { ArticleDetailDto, ReadingProgressUpdateBody } from "../schemas/article";

export type Flags = { isRead?: boolean; isSaved?: boolean };
export type Snapshot = { title: string; text: string; contentKey: string };
export type OfflineArticle = {
  id: string;
  saved: boolean;
  read: boolean;
  document: Snapshot | null;
  position: number;
  flags: Flags;
  progress: ReadingProgressUpdateBody | null;
  revision: number;
};
export type Edit = (row: OfflineArticle | undefined) => OfflineArticle | undefined;
export interface Library {
  list(owner: string, pendingOnly?: boolean): Promise<OfflineArticle[]>;
  edit(owner: string, id: string, change: Edit): Promise<void>;
}

export function snapshot(article: ArticleDetailDto): Snapshot {
  const body = article.reader.selected;
  let text = body.contentText || body.contentMarkdown || body.fallbackSummary || "";
  if (!text && body.contentHtml) {
    // Decode entities and retain paragraph breaks without creating a DOM or loading any media.
    const chunks: string[] = [];
    const parser = new Parser({
      ontext: (value) => chunks.push(value),
      onclosetag: (tag) => {
        if (/^(p|div|li|br|h[1-6]|pre|tr|blockquote)$/.test(tag)) chunks.push("\n");
      },
    });
    parser.end(body.contentHtml);
    text = chunks.join("");
  }
  return {
    title: article.title,
    contentKey: buildContentKey(body),
    text: (text || article.summary || "").trim(),
  };
}

export function needsSync(row: OfflineArticle) {
  return Object.keys(row.flags).length > 0 || row.progress !== null || (row.saved && !row.document);
}

export function rememberSaved(
  store: Library,
  owner: string,
  item: Pick<ArticleDetailDto, "id" | "title" | "isRead" | "isSaved">,
) {
  if (!item.isSaved) return Promise.resolve();
  return store.edit(
    owner,
    item.id,
    (previous) =>
      previous ?? {
        id: item.id,
        saved: true,
        read: item.isRead,
        document: null,
        position: 0,
        flags: {},
        progress: null,
        revision: 0,
      },
  );
}

export function editFlags(
  store: Library,
  owner: string,
  id: string,
  flags: Flags,
  article?: ArticleDetailDto,
) {
  return store.edit(owner, id, (previous) => {
    const row = previous ?? {
      id,
      saved: article?.isSaved ?? false,
      read: article?.isRead ?? false,
      document: null,
      position: article?.readingPosition?.progress ?? 0,
      flags: {},
      progress: null,
      revision: 0,
    };
    return {
      ...row,
      saved: flags.isSaved ?? row.saved,
      read: flags.isRead ?? row.read,
      document: row.document ?? (article ? snapshot(article) : null),
      flags: { ...row.flags, ...flags },
      revision: row.revision + 1,
    };
  });
}

export function editProgress(
  store: Library,
  owner: string,
  id: string,
  progress: ReadingProgressUpdateBody,
) {
  return store.edit(
    owner,
    id,
    (row) => row && { ...row, position: progress.progress, progress, revision: row.revision + 1 },
  );
}

export type Transport = {
  detail(id: string): Promise<ArticleDetailDto>;
  put(id: string, path: "" | "/progress", body: Flags | ReadingProgressUpdateBody): Promise<void>;
};

export async function replay(store: Library, owner: string, api: Transport) {
  let firstFailure: unknown;
  for (const row of await store.list(owner, true)) {
    try {
      if (Object.keys(row.flags).length) await api.put(row.id, "", row.flags);
      if (row.progress) await api.put(row.id, "/progress", row.progress);
      const detail = row.saved && !row.document ? await api.detail(row.id) : null;
      if (!detail && !Object.keys(row.flags).length && !row.progress) continue;
      await store.edit(owner, row.id, (latest) => {
        if (latest?.revision !== row.revision) return latest;
        if (!latest.saved) return undefined;
        return {
          ...latest,
          read: detail?.isRead ?? latest.read,
          position: row.progress
            ? latest.position
            : (detail?.readingPosition?.progress ?? latest.position),
          document: detail ? snapshot(detail) : latest.document,
          flags: {},
          progress: null,
        };
      });
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (!status || status === 401 || status === 429) throw error;
      if (status !== 404 && status !== 410) {
        firstFailure ??= error;
        continue;
      }
      await store.edit(owner, row.id, (latest) =>
        latest?.revision === row.revision ? undefined : latest,
      );
    }
  }
  if (firstFailure) throw firstFailure;
}

export function pages(text: string): string[] {
  // Word boundaries preserve readability; a long URL or a single unbroken word remains intact.
  return text.match(/[\s\S]{1,1600}(?:\s+|$)|\S+\s*/g) ?? [];
}

export function pagePosition(page: number, count: number) {
  return count <= 1 ? 0 : page / (count - 1);
}

import { createAppStorage } from "@lib/storage";

const storage = createAppStorage("reader-position");
const PREFIX = "index:";

/** Segment index of the first visible row; stable across font size and width changes, unlike pixels. */
export function readReaderPosition(articleId: string): number | undefined {
  const raw = storage.getString(`${PREFIX}${articleId}`);
  const index = raw === undefined ? NaN : Number(raw);
  return Number.isInteger(index) && index > 0 ? index : undefined;
}

export function writeReaderPosition(articleId: string, index: number): void {
  if (index <= 0) {
    storage.remove(`${PREFIX}${articleId}`);
    return;
  }
  storage.set(`${PREFIX}${articleId}`, String(index));
}

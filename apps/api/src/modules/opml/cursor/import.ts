export type OpmlImportCursor = { createdAt: string; id: string };

const CURSOR_VERSION = 1;

export function encodeOpmlImportCursor(cursor: OpmlImportCursor): string {
  return Buffer.from(
    JSON.stringify({ v: CURSOR_VERSION, createdAt: cursor.createdAt, id: cursor.id }),
    "utf8",
  ).toString("base64url");
}

export function decodeOpmlImportCursor(value: string | undefined): OpmlImportCursor | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      parsed.v !== CURSOR_VERSION ||
      typeof parsed.createdAt !== "string" ||
      parsed.createdAt.length === 0 ||
      Number.isNaN(Date.parse(parsed.createdAt)) ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0
    ) {
      return null;
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

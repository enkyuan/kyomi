export function encodeCursorPayload(prefix: string, payload: unknown): string {
  return `${prefix}${Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")}`;
}

export function decodeCursorPayload<T>(
  prefix: string,
  cursor: string,
  onInvalid: () => never,
): T {
  if (!cursor.startsWith(prefix)) {
    onInvalid();
  }

  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(cursor.slice(prefix.length), "base64url").toString("utf8"));
  } catch {
    onInvalid();
  }

  if (!raw || typeof raw !== "object") {
    onInvalid();
  }

  return raw as T;
}

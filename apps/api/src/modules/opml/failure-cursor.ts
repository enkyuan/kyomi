export type OpmlFailureCursor = { position: number; id: string };

export function encodeOpmlFailureCursor(cursor: OpmlFailureCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeOpmlFailureCursor(value: string | undefined): OpmlFailureCursor | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      typeof parsed.position !== "number" ||
      !Number.isInteger(parsed.position) ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0
    ) {
      return null;
    }
    return { position: parsed.position, id: parsed.id };
  } catch {
    return null;
  }
}

export function normalizeLoopbackUrl(rawUrl: string): string {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  if (parsed.hostname !== "localhost") {
    return rawUrl;
  }

  parsed.hostname = "127.0.0.1";
  return parsed.toString();
}

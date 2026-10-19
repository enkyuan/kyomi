export function assertHttpOrHttpsUrl(
  raw: string,
  message = "Only http(s) URLs are supported",
): URL {
  const url = new URL(raw.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(message);
  }
  return url;
}

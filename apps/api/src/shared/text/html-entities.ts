import { decodeHtmlEntities } from "@vols.rss/ingestion";

export function decodeText(value: string): string {
  return decodeHtmlEntities(value).trim();
}

export function decodeNullableText(value: string | null): string | null {
  if (value == null) {
    return null;
  }

  const decoded = decodeText(value);
  return decoded || null;
}

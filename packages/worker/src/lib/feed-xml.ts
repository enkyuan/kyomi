import { stripTags } from "./feed-text";

function xmlText(value: unknown): string {
  if (typeof value === "string") {
    return stripTags(value).trim();
  }
  if (value && typeof value === "object" && "#text" in value) {
    return stripTags(String((value as { "#text": unknown })["#text"])).trim();
  }
  return "";
}

function rawText(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }
  if (value && typeof value === "object" && "#text" in value) {
    const raw = String((value as { "#text": unknown })["#text"]).trim();
    return raw || null;
  }
  return null;
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value == null ? [] : [value];
}

function pickRssLink(link: unknown, fallback: string): string {
  if (typeof link === "string" && link.trim()) {
    return link.trim();
  }
  for (const candidate of toArray(link)) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
    if (candidate && typeof candidate === "object" && "#text" in candidate) {
      const text = String((candidate as { "#text": unknown })["#text"]).trim();
      if (text) {
        return text;
      }
    }
  }
  return fallback;
}

function pickAtomLink(link: unknown, fallback: string): string {
  const candidates = toArray(link);
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }
    const record = candidate as Record<string, unknown>;
    const rel = record["@_rel"];
    const href = record["@_href"];
    if (typeof href === "string" && href.trim()) {
      if (rel === "alternate" || rel === undefined || rel === "self") {
        return href.trim();
      }
    }
  }
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }
    const href = (candidate as Record<string, unknown>)["@_href"];
    if (typeof href === "string" && href.trim()) {
      return href.trim();
    }
  }
  return fallback;
}

function parsePublishedAt(value: unknown, fallback: Date): Date {
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return fallback;
}

export { xmlText, rawText, toArray, pickRssLink, pickAtomLink, parsePublishedAt };

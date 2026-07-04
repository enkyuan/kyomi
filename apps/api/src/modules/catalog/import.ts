import { toCategorySlug } from "@kyomi/db";
import { assertHttpOrHttpsUrl, normalizeFeedUrl } from "@modules/discover/feed/normalize-url";

export { toCategorySlug };

export type CatalogFeedRecord = {
  feed_url: string;
  title?: string | null;
  description?: string | null;
  link?: string | null;
  source?: string | null;
  language?: string | null;
  category?: string | null;
  content_type?: string | null;
  quality_score?: number | null;
};

export type ImportStats = {
  processed: number;
  imported: number;
  skipped: number;
  failed: number;
  categoryAssignments: number;
  languageAssignments: number;
};

export type ValidationReport = {
  missingTitle: number;
  missingSiteUrl: number;
  missingLanguage: number;
  missingCategory: number;
};

export type NormalizedImportRecord = {
  canonicalUrl: string;
  title: string;
  description: string | null;
  link: string | null;
  catalogSource: string | null;
  language: string | null;
  category: string | null;
  contentType: string | null;
  qualityScore: number | null;
};

function trimmedOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function parseRecord(line: string): CatalogFeedRecord | null {
  const raw = line.trim();
  if (!raw) {
    return null;
  }
  const parsed = JSON.parse(raw) as Partial<CatalogFeedRecord>;
  if (typeof parsed.feed_url !== "string" || parsed.feed_url.trim().length === 0) {
    return null;
  }
  return {
    feed_url: parsed.feed_url.trim(),
    title: trimmedOrNull(parsed.title),
    description: trimmedOrNull(parsed.description),
    link: trimmedOrNull(parsed.link),
    source: trimmedOrNull(parsed.source),
    language: trimmedOrNull(parsed.language),
    category: trimmedOrNull(parsed.category),
    content_type: trimmedOrNull(parsed.content_type),
    quality_score: typeof parsed.quality_score === "number" ? parsed.quality_score : null,
  };
}

function resolveCanonicalUrl(raw: string): string {
  const asserted = assertHttpOrHttpsUrl(raw);
  return normalizeFeedUrl(asserted.href);
}

export function normalizeImportRecord(record: CatalogFeedRecord): NormalizedImportRecord {
  const canonicalUrl = resolveCanonicalUrl(record.feed_url);
  return {
    canonicalUrl,
    title: record.title && record.title.length > 0 ? record.title : canonicalUrl,
    description: record.description && record.description.length > 0 ? record.description : null,
    link: record.link && record.link.length > 0 ? record.link : null,
    catalogSource: record.source ?? null,
    language: record.language ?? null,
    category: record.category ?? null,
    contentType: record.content_type ?? null,
    qualityScore: record.quality_score ?? null,
  };
}

export function reportValidation(
  report: ValidationReport,
  record: NormalizedImportRecord,
  isTitleFromUrl: boolean,
): void {
  if (isTitleFromUrl) {
    report.missingTitle += 1;
  }
  if (!record.link) {
    report.missingSiteUrl += 1;
  }
  if (!record.language) {
    report.missingLanguage += 1;
  }
  if (!record.category) {
    report.missingCategory += 1;
  }
}

export function domainFromUrl(raw: string): string | null {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

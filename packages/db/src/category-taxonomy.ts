export const MISCELLANEOUS_CATEGORY_LABEL = "Miscellaneous";

export const CANONICAL_CATEGORY_LABELS = [
  "AI & ML",
  "Software Engineering",
  "Security & Privacy",
  "Technology",
  "Science & Research",
  "Business & Startups",
  "Finance & Markets",
  "Politics & Policy",
  "World & Society",
  "Culture & Media",
  "Design & UX",
  "Health & Medicine",
  "Climate & Environment",
  "Education & Work",
  "Sports",
  "Food & Travel",
  "Personal & Essays",
  MISCELLANEOUS_CATEGORY_LABEL,
] as const;

const CANONICAL_LABEL_SET: ReadonlySet<string> = new Set(CANONICAL_CATEGORY_LABELS);

// Lowercased so a case-insensitive lookup of any canonical label (e.g. "MISCELLANEOUS") resolves
// to its exact canonical spelling, not just an exact-case match.
const CANONICAL_LABEL_BY_LOWERCASE: ReadonlyMap<string, string> = new Map(
  CANONICAL_CATEGORY_LABELS.map((label) => [label.toLowerCase(), label]),
);

// Alias keys are matched case-insensitively against a raw source label (RSS/Atom/JSON Feed
// category, catalog category, or classifier output) after trimming whitespace. Includes labels
// from the taxonomy's previous (pre-canonicalization) fallback and category names so existing
// data migrates onto a canonical label instead of being dropped as unmapped.
const CATEGORY_ALIASES: ReadonlyMap<string, string> = new Map([
  ["general", "Miscellaneous"],

  ["ai", "AI & ML"],
  ["ai & ml", "AI & ML"],
  ["llm", "AI & ML"],
  ["machine learning", "AI & ML"],
  ["artificial intelligence", "AI & ML"],
  ["deep learning", "AI & ML"],

  ["software engineering", "Software Engineering"],
  ["programming", "Software Engineering"],
  ["javascript", "Software Engineering"],
  ["typescript", "Software Engineering"],
  ["engineering", "Software Engineering"],
  ["developer", "Software Engineering"],
  ["development", "Software Engineering"],

  ["security", "Security & Privacy"],
  ["security & privacy", "Security & Privacy"],
  ["cybersecurity", "Security & Privacy"],
  ["cve", "Security & Privacy"],
  ["malware", "Security & Privacy"],
  ["privacy", "Security & Privacy"],

  ["technology", "Technology"],
  ["tech", "Technology"],

  ["news", "World & Society"],
  ["world news", "World & Society"],
  ["international", "World & Society"],
  ["world & society", "World & Society"],
  ["society", "World & Society"],

  ["startup", "Business & Startups"],
  ["startups", "Business & Startups"],
  ["business", "Business & Startups"],
  ["business & startups", "Business & Startups"],
  ["venture", "Business & Startups"],
  ["saas", "Business & Startups"],
  ["company", "Business & Startups"],

  ["finance", "Finance & Markets"],
  ["finance & markets", "Finance & Markets"],
  ["fintech", "Finance & Markets"],
  ["crypto", "Finance & Markets"],
  ["bitcoin", "Finance & Markets"],
  ["market", "Finance & Markets"],
  ["markets", "Finance & Markets"],

  ["politics", "Politics & Policy"],
  ["politics & policy", "Politics & Policy"],
  ["policy", "Politics & Policy"],

  ["science", "Science & Research"],
  ["science & research", "Science & Research"],
  ["research", "Science & Research"],
  ["biology", "Science & Research"],
  ["physics", "Science & Research"],
  ["space", "Science & Research"],

  ["health", "Health & Medicine"],
  ["health & medicine", "Health & Medicine"],
  ["medicine", "Health & Medicine"],
  ["biotech", "Health & Medicine"],
  ["medical", "Health & Medicine"],

  ["climate", "Climate & Environment"],
  ["climate & environment", "Climate & Environment"],
  ["environment", "Climate & Environment"],
  ["energy", "Climate & Environment"],

  ["podcasts", "Culture & Media"],
  ["podcast", "Culture & Media"],
  ["film", "Culture & Media"],
  ["music", "Culture & Media"],
  ["books", "Culture & Media"],
  ["art", "Culture & Media"],
  ["culture", "Culture & Media"],
  ["culture & media", "Culture & Media"],

  ["design", "Design & UX"],
  ["design & ux", "Design & UX"],
  ["ux", "Design & UX"],

  ["education", "Education & Work"],
  ["education & work", "Education & Work"],
  ["work", "Education & Work"],
  ["career", "Education & Work"],

  ["sports", "Sports"],

  ["food", "Food & Travel"],
  ["food & travel", "Food & Travel"],
  ["travel", "Food & Travel"],

  ["personal", "Personal & Essays"],
  ["personal & essays", "Personal & Essays"],
  ["essays", "Personal & Essays"],
]);

/**
 * Maps a raw source label (RSS/Atom/JSON Feed category, catalog category, or classifier
 * output) to a canonical category label, or `null` if the label has no known mapping.
 * Callers decide what to do with an unmapped label (e.g. skip the assignment, or fall
 * back to the classifier) rather than this function guessing a default.
 */
export function mapCategoryLabelToCanonical(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) {
    return null;
  }
  if (CANONICAL_LABEL_SET.has(trimmed)) {
    return trimmed;
  }
  const lowercased = trimmed.toLowerCase();
  return CANONICAL_LABEL_BY_LOWERCASE.get(lowercased) ?? CATEGORY_ALIASES.get(lowercased) ?? null;
}

export function isCanonicalCategoryLabel(label: string): boolean {
  return CANONICAL_LABEL_SET.has(label);
}

/**
 * Maps and dedupes a list of raw source labels down to their canonical labels, in
 * first-seen order. Labels with no known mapping are dropped.
 */
export function canonicalizeCategoryLabels(labels: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const label of labels) {
    const canonical = mapCategoryLabelToCanonical(label);
    if (canonical && !seen.has(canonical)) {
      seen.add(canonical);
      result.push(canonical);
    }
  }
  return result;
}

import { MISCELLANEOUS_CATEGORY_LABEL } from "@kyomi/db";

export const CATEGORY_CLASSIFIER_PROVENANCE = "classifier";

// Stamped onto every classifier-produced category assignment row so a future re-classify
// pass can pick out stale rows (e.g. after the taxonomy adds a category, or when a
// classifier's own logic changes and its rows need refreshing). `classifierMethod`
// ("keyword" | "embedding") lets the read path rank rows without parsing `modelId`; bump the
// relevant `*_MODEL_ID` when that classifier's scoring/embedding logic changes in a way that
// could yield different labels for identical inputs; bump the shared taxonomy version when a
// category is added/removed/renamed (both classifiers score against the same category set).
export const KEYWORD_CLASSIFIER_METHOD = "keyword";
export const KEYWORD_CLASSIFIER_MODEL_ID = "keyword-v1";
export const EMBEDDING_CLASSIFIER_METHOD = "embedding";
export const EMBEDDING_CLASSIFIER_MODEL_ID = "voyage-4";
export const CLASSIFIER_TAXONOMY_VERSION = "v1";
export { MISCELLANEOUS_CATEGORY_LABEL };

export type CategoryTaxonomyEntry = {
  label: string;
  slug: string;
  keywords: readonly string[];
  weakKeywords?: readonly string[];
  domainHints: readonly string[];
  strongDomainHints?: readonly string[];
};

export const MIXED_FEED_HOSTS = new Set([
  "news.ycombinator.com",
  "lobste.rs",
  "reddit.com",
  "old.reddit.com",
  "slashdot.org",
]);

// Every `label` here must be one of the canonical labels in `@kyomi/db`'s
// `CANONICAL_CATEGORY_LABELS` so classifier output never needs a second normalization pass.
export const CATEGORY_TAXONOMY: readonly CategoryTaxonomyEntry[] = [
  {
    label: "Software Engineering",
    slug: "software-engineering",
    keywords: [
      "api",
      "architecture",
      "backend",
      "code",
      "compiler",
      "database",
      "developer",
      "engineering",
      "frontend",
      "git",
      "github",
      "infrastructure",
      "javascript",
      "kubernetes",
      "package management",
      "package manager",
      "programming",
      "python",
      "react",
      "rust",
      "software",
      "typescript",
      "version control",
      "build system",
      "zig",
    ],
    domainHints: ["github.com", "gitlab.com", "stackoverflow.com", "medium.com"],
    strongDomainHints: ["github.com", "gitlab.com", "stackoverflow.com", "ziglang.org"],
  },
  {
    label: "Technology",
    slug: "technology",
    keywords: [
      "changelog",
      "chip",
      "computer",
      "gadget",
      "hardware",
      "internet",
      "metasearch",
      "platform",
      "search engine",
      "startup",
      "technology",
    ],
    weakKeywords: ["app", "tech", "web"],
    domainHints: [
      "kagi.com",
      "searxng.org",
      "techcrunch.com",
      "wired.com",
      "theverge.com",
      "arstechnica.com",
    ],
  },
  {
    label: "Security & Privacy",
    slug: "security-privacy",
    keywords: [
      "attack",
      "breach",
      "cve",
      "exploit",
      "leak",
      "leaking",
      "malware",
      "password",
      "privacy",
      "privilege",
      "ransomware",
      "security",
      "threat",
      "vulnerability",
    ],
    weakKeywords: ["private"],
    domainHints: ["krebsonsecurity.com", "bleepingcomputer.com", "hackercombat.com"],
  },
  {
    label: "AI & ML",
    slug: "ai-ml",
    keywords: [
      "agent",
      "ai",
      "artificial intelligence",
      "embedding",
      "language model",
      "llm",
      "machine learning",
      "neural",
      "openai",
      "transformer",
    ],
    weakKeywords: ["model"],
    domainHints: ["openai.com", "huggingface.co", "arxiv.org"],
  },
  {
    label: "Science & Research",
    slug: "science-research",
    keywords: [
      "astronomy",
      "biology",
      "brain",
      "discovery",
      "experiment",
      "migration",
      "physics",
      "research",
      "science",
      "scientist",
      "space",
    ],
    domainHints: ["nature.com", "science.org", "news.exeter.ac.uk", "engineering.columbia.edu"],
  },
  {
    label: "Business & Startups",
    slug: "business-startups",
    keywords: ["business", "earnings", "funding", "revenue", "startup", "venture"],
    weakKeywords: ["company"],
    domainHints: ["bloomberg.com", "wsj.com", "ft.com", "techcrunch.com"],
  },
  {
    label: "Finance & Markets",
    slug: "finance-markets",
    keywords: [
      "bank",
      "bitcoin",
      "crypto",
      "economy",
      "finance",
      "inflation",
      "investment",
      "market",
      "money",
      "stock",
    ],
    domainHints: ["finance.yahoo.com", "marketwatch.com", "coinbase.com"],
  },
  {
    label: "Politics & Policy",
    slug: "politics-policy",
    keywords: [
      "congress",
      "election",
      "government",
      "law",
      "policy",
      "politics",
      "president",
      "regulation",
      "senate",
      "supreme court",
    ],
    domainHints: ["politico.com", "whitehouse.gov", "congress.gov"],
  },
  {
    label: "World & Society",
    slug: "world-society",
    keywords: ["breaking", "headline", "international", "society", "world"],
    weakKeywords: ["news"],
    domainHints: ["apnews.com", "reuters.com", "bbc.com", "nytimes.com"],
  },
  {
    label: "Culture & Media",
    slug: "culture-media",
    keywords: ["art", "book", "culture", "film", "history", "music", "podcast", "writing"],
    domainHints: ["newyorker.com", "theatlantic.com", "lithub.com"],
  },
  {
    label: "Design & UX",
    slug: "design-ux",
    keywords: [
      "brand",
      "design",
      "figma",
      "interface",
      "product design",
      "typography",
      "ui",
      "user experience",
      "ux",
      "visual",
    ],
    domainHints: ["dribbble.com", "figma.com", "smashingmagazine.com"],
  },
  {
    label: "Health & Medicine",
    slug: "health-medicine",
    keywords: [
      "clinical",
      "doctor",
      "drug",
      "health",
      "medical",
      "medicine",
      "patient",
      "public health",
      "vaccine",
    ],
    domainHints: ["nih.gov", "who.int", "nejm.org"],
  },
  {
    label: "Climate & Environment",
    slug: "climate-environment",
    keywords: ["climate", "emissions", "energy", "environment", "renewable", "sustainability"],
    domainHints: ["climate.gov", "carbonbrief.org"],
  },
  {
    label: "Education & Work",
    slug: "education-work",
    keywords: ["career", "classroom", "curriculum", "education", "student", "teacher", "workplace"],
    domainHints: ["edutopia.org", "chronicle.com"],
  },
  {
    label: "Sports",
    slug: "sports",
    keywords: [
      "baseball",
      "basketball",
      "football",
      "game",
      "league",
      "match",
      "soccer",
      "sports",
      "team",
    ],
    domainHints: ["espn.com", "theathletic.com", "mlb.com", "nba.com", "nfl.com"],
  },
  {
    label: "Food & Travel",
    slug: "food-travel",
    keywords: [
      "airline",
      "baking",
      "chef",
      "cooking",
      "flight",
      "food",
      "hotel",
      "kitchen",
      "recipe",
      "restaurant",
      "tourism",
      "travel",
      "trip",
    ],
    domainHints: ["seriouseats.com", "bonappetit.com", "lonelyplanet.com", "cntraveler.com"],
  },
  {
    label: "Personal & Essays",
    slug: "personal-essays",
    keywords: ["diary", "essay", "memoir", "personal", "reflection"],
    domainHints: ["lithub.com"],
  },
];

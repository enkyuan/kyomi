import { describe, expect, test } from "bun:test";
import {
  classifyFeedCategories,
  classifyItemCategories,
  isMixedFeedHost,
  shouldSuppressFallback,
} from "@kyomi/worker";

describe("feed category classifier", () => {
  test("classifies technology feeds without RSS category tags", () => {
    const result = classifyFeedCategories({
      feedTitle: "Airbnb Engineering",
      feedDescription:
        "Engineering posts about infrastructure, data, product systems, and software architecture.",
      feedUrl: "https://medium.com/feed/airbnb-engineering",
      feedSiteUrl: "https://medium.com/airbnb-engineering",
      sourceKind: "rss",
    });

    // The taxonomy has no parent/child category relationship, so a feed whose only keyword
    // hits are "Software Engineering" terms does not separately clear the "Technology"
    // threshold. Asserting the real winning label keeps this test honest about what the
    // deterministic keyword scorer actually produces.
    expect(result.categories.map((category) => category.label)).toEqual(["Software Engineering"]);
    expect(result.categories.every((category) => category.confidence >= 0.5)).toBe(true);
  });

  test("classifies security articles inside mixed feeds", () => {
    const result = classifyItemCategories({
      feedTitle: "Hacker News",
      feedDescription: "Links for hackers",
      feedUrl: "https://news.ycombinator.com/rss",
      feedSiteUrl: "https://news.ycombinator.com",
      sourceKind: "rss",
      itemTitle: "MSI Center - How to gain SYSTEM privileges in seconds",
      itemSummary: "A local privilege escalation vulnerability lets attackers gain SYSTEM access.",
      itemUrl: "https://mrbruh.com/msi-center-privilege-escalation",
    });

    expect(result.categories.map((category) => category.label)).toEqual(["Security & Privacy"]);
    expect(result.categories[0]?.confidence).toBeGreaterThanOrEqual(0.5);
  });

  test("classifies science articles from title and source domain", () => {
    const result = classifyItemCategories({
      feedTitle: "Hacker News",
      feedDescription: "Links for hackers",
      feedUrl: "https://news.ycombinator.com/rss",
      feedSiteUrl: "https://news.ycombinator.com",
      sourceKind: "rss",
      itemTitle: "Scientists discover guidance system for migratory songbirds",
      itemSummary: "Researchers describe neural circuits used for migration.",
      itemUrl: "https://news.exeter.ac.uk/songbirds-guidance-system",
    });

    expect(result.categories.map((category) => category.label)).toEqual(["Science & Research"]);
  });

  test("classifies an AI story from title and body keywords", () => {
    const result = classifyItemCategories({
      feedTitle: "Hacker News",
      feedDescription: "Links for hackers",
      feedUrl: "https://news.ycombinator.com/rss",
      feedSiteUrl: "https://news.ycombinator.com",
      sourceKind: "rss",
      itemTitle: "New open-weights language model released",
      itemSummary: "The transformer model uses embeddings trained by an autonomous agent pipeline.",
      itemUrl: "https://huggingface.co/blog/new-model",
    });

    expect(result.categories.map((category) => category.label)).toEqual(["AI & ML"]);
  });

  test("returns Miscellaneous for sparse unknown feeds", () => {
    const result = classifyFeedCategories({
      feedTitle: "Updates",
      feedDescription: "",
      feedUrl: "https://example.invalid/feed.xml",
      feedSiteUrl: "https://example.invalid",
      sourceKind: "rss",
    });

    expect(result.categories).toEqual([{ label: "Miscellaneous", confidence: 0.1 }]);
  });

  test("detects known mixed feed hosts", () => {
    expect(isMixedFeedHost("https://news.ycombinator.com/rss")).toBe(true);
    expect(isMixedFeedHost("https://lobste.rs/rss")).toBe(true);
    expect(isMixedFeedHost("https://example.com/rss")).toBe(false);
  });

  test("does not let parent feed metadata dilute item classification", () => {
    const result = classifyItemCategories({
      feedTitle: "AI & ML Daily",
      feedDescription:
        "Language model, transformer, embedding, agent, and artificial intelligence analysis.",
      feedUrl: "https://example.com/rss",
      feedSiteUrl: "https://example.com",
      sourceKind: "rss",
      itemTitle: "A practical guide to pasta dough and weeknight cooking",
      itemSummary: "Chef notes on kitchen technique, recipe testing, and restaurant prep.",
      itemUrl: "https://seriouseats.com/pasta-dough-guide",
    });

    const labels = result.categories.map((category) => category.label);
    expect(labels).toContain("Food & Travel");
    expect(labels).not.toContain("AI & ML");
  });

  test("uses enriched content text when RSS summary is thin", () => {
    const result = classifyItemCategories({
      feedTitle: "Daily Links",
      feedDescription: "A mixed collection of links.",
      feedUrl: "https://example.com/rss",
      feedSiteUrl: "https://example.com",
      sourceKind: "rss",
      itemTitle: "Release notes",
      itemSummary: "Comments",
      itemContentText:
        "The new open weights language model uses transformer layers, embeddings, and agent training data.",
      itemUrl: "https://huggingface.co/blog/open-model-release",
    });

    expect(result.categories.map((category) => category.label)).toEqual(["AI & ML"]);
  });

  test("classifies thin search-product titles with targeted technology signals", () => {
    const result = classifyItemCategories({
      feedTitle: "Hacker News",
      feedDescription: "Links for hackers",
      feedUrl: "https://news.ycombinator.com/rss",
      feedSiteUrl: "https://news.ycombinator.com",
      sourceKind: "rss",
      itemTitle: "SearXNG: A free internet metasearch engine",
      itemSummary: null,
      itemUrl: "https://docs.searxng.org/",
    });

    expect(result.categories.map((category) => category.label)).toEqual(["Technology"]);
  });

  test("classifies thin developer-tool titles with git and host signals", () => {
    const result = classifyItemCategories({
      feedTitle: "Hacker News",
      feedDescription: "Links for hackers",
      feedUrl: "https://news.ycombinator.com/rss",
      feedSiteUrl: "https://news.ycombinator.com",
      sourceKind: "rss",
      itemTitle: "Oak: Git for Agents",
      itemSummary: null,
      itemUrl: "https://github.com/oak/oak",
    });

    expect(result.categories.map((category) => category.label)).toEqual(["Software Engineering"]);
  });

  test("classifies thin compiler and package-management titles", () => {
    const result = classifyItemCategories({
      feedTitle: "Hacker News",
      feedDescription: "Links for hackers",
      feedUrl: "https://news.ycombinator.com/rss",
      feedSiteUrl: "https://news.ycombinator.com",
      sourceKind: "rss",
      itemTitle: "Zig: All Package Management Functionality Moved from Compiler to Build System",
      itemSummary: null,
      itemUrl: "https://ziglang.org/devlog/2026/#2026-06-30",
    });

    expect(result.categories.map((category) => category.label)).toEqual(["Software Engineering"]);
  });

  test("classifies code-hosted project links from strong source domains", () => {
    const result = classifyItemCategories({
      feedTitle: "Hacker News",
      feedDescription: "Links for hackers",
      feedUrl: "https://news.ycombinator.com/rss",
      feedSiteUrl: "https://news.ycombinator.com",
      sourceKind: "rss",
      itemTitle: "Windows CE Dreamcast Community Edition (wince-dc)",
      itemSummary: null,
      itemUrl: "https://github.com/maximqaxd/wince-dc",
    });

    expect(result.categories.map((category) => category.label)).toEqual(["Software Engineering"]);
  });

  test("does not classify a single generic dev-tool title word without a corroborating signal", () => {
    // A bare "git" hit in the title (score 3) alone does not clear ITEM_SCORE_THRESHOLD=4
    // without a domain hint or a second keyword — this keeps the classifier honest about
    // requiring more than one generic word before assigning a label, the same discipline
    // that moved "news"/"app"/"web"/"tech" into weakKeywords elsewhere in this taxonomy.
    const result = classifyItemCategories({
      feedTitle: "Hacker News",
      feedDescription: "Links for hackers",
      feedUrl: "https://news.ycombinator.com/rss",
      feedSiteUrl: "https://news.ycombinator.com",
      sourceKind: "rss",
      itemTitle: "Oak: Git for Agents",
      itemSummary: null,
      itemUrl: "https://oak.space/",
    });

    expect(result.categories).toEqual([]);
  });

  test("classifies leaking private-video stories as security and privacy", () => {
    const result = classifyItemCategories({
      feedTitle: "Hacker News",
      feedDescription: "Links for hackers",
      feedUrl: "https://news.ycombinator.com/rss",
      feedSiteUrl: "https://news.ycombinator.com",
      sourceKind: "rss",
      itemTitle: "Leaking YouTube creators' private videos",
      itemSummary: null,
      itemUrl: "https://javoriuski.com/blog/leaking-youtube-creators-private-videos",
    });

    expect(result.categories.map((category) => category.label)).toEqual(["Security & Privacy"]);
  });

  test("classifies thin changelog titles with product host signals", () => {
    const result = classifyItemCategories({
      feedTitle: "Hacker News",
      feedDescription: "Links for hackers",
      feedUrl: "https://news.ycombinator.com/rss",
      feedSiteUrl: "https://news.ycombinator.com",
      sourceKind: "rss",
      itemTitle: "Kagi Changelog",
      itemSummary: null,
      itemUrl: "https://kagi.com/changelog",
    });

    expect(result.categories.map((category) => category.label)).toEqual(["Technology"]);
  });

  test("does not classify from broad weak words alone", () => {
    const result = classifyItemCategories({
      feedTitle: "Hacker News",
      feedDescription: "Links for hackers",
      feedUrl: "https://news.ycombinator.com/rss",
      feedSiteUrl: "https://news.ycombinator.com",
      sourceKind: "rss",
      itemTitle: "Company news app updates",
      itemSummary: null,
      itemUrl: "https://example.com/updates",
    });

    expect(result.categories).toEqual([]);
  });

  test("suppresses classifier feed fallback for broad aggregator feeds", () => {
    expect(
      shouldSuppressFallback({
        feedTitle: "Hacker News",
        feedDescription: "Links for hackers",
        feedUrl: "https://news.ycombinator.com/rss",
        feedSiteUrl: "https://news.ycombinator.com",
        sourceKind: "rss",
      }),
    ).toBe(true);

    expect(
      shouldSuppressFallback({
        feedTitle: "Airbnb Engineering",
        feedDescription: "Software engineering posts about infrastructure and architecture.",
        feedUrl: "https://medium.com/feed/airbnb-engineering",
        feedSiteUrl: "https://medium.com/airbnb-engineering",
        sourceKind: "rss",
      }),
    ).toBe(false);
  });

  test("accepts a maxLabels override so callers can post-filter without losing candidates", () => {
    const input = {
      feedTitle: "Tech Blog",
      feedDescription: "",
      feedUrl: "https://example.com/rss",
      feedSiteUrl: "https://example.com",
      sourceKind: "rss",
      itemTitle: "Technology security AI: startup builds machine learning cybersecurity platform",
      itemSummary:
        "The company uses artificial intelligence, neural networks, and embeddings for threat detection. A tech startup platform for enterprise apps and hardware gadgets.",
      itemUrl: "https://example.com/article",
    };

    // With the default cap, only the top 2 scored categories are ever returned.
    const defaultResult = classifyItemCategories(input);
    expect(defaultResult.categories).toHaveLength(2);

    // A caller that will filter out one of those two (e.g. because it duplicates an
    // explicit source label) needs to ask for more candidates up front, since truncation
    // happens inside the classifier before the caller ever sees the list.
    const expandedResult = classifyItemCategories(input, 3);
    expect(expandedResult.categories.length).toBeGreaterThan(defaultResult.categories.length);
    expect(expandedResult.categories.map((category) => category.label)).toEqual(
      expect.arrayContaining(defaultResult.categories.map((category) => category.label)),
    );
  });
});

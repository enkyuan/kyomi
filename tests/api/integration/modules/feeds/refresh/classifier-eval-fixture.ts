/**
 * Ground-truth fixture for the classifier eval harness. Each case is either:
 *
 * - a session-regression case (locked from a prior bug that shipped or was caught in review):
 *   changing its expected labels means undoing a real user-visible fix.
 * - a category-coverage case (one clearly positive + one deliberately adversarial per canonical
 *   category): captures the intent of each category so a future classifier that "wins" on
 *   average without covering a category shows up as a regression on the per-category F1.
 * - a field case (a real-world headline a classifier missed): a held-out set scored on its own.
 *   Never write category-card prototypes from these cases, or the embedding eval stops measuring
 *   generalization.
 *
 * `expected` is the set of canonical labels a correct classifier should return. Empty array
 * means the classifier should abstain — that is a valid, load-bearing outcome (see the
 * "Company news app updates" regression). Fixture cases must NOT depend on which classifier
 * implementation is under test.
 */
export type ClassifierEvalCase = {
  id: string;
  source: "regression" | "coverage" | "field";
  itemTitle: string;
  itemSummary: string | null;
  itemContentText?: string | null;
  itemUrl: string | null;
  feedTitle: string;
  feedDescription: string | null;
  feedUrl: string;
  feedSiteUrl: string | null;
  sourceKind: string | null;
  expected: readonly string[];
  note?: string;
};

// Snapshot of https://news.ycombinator.com/rss as of 2026-07. Frozen intentionally so
// tests remain reproducible if HN edits their channel-level `<description>` — cases that
// need to test against a different feed shape override the relevant field inline.
const HN = {
  feedTitle: "Hacker News",
  feedDescription: "Links for the intellectually curious, ranked by readers.",
  feedUrl: "https://news.ycombinator.com/rss",
  feedSiteUrl: "https://news.ycombinator.com",
  sourceKind: "rss" as const,
};

export const CLASSIFIER_EVAL_FIXTURE: readonly ClassifierEvalCase[] = [
  // ── Session regressions ──────────────────────────────────────────────────────
  {
    id: "regression-git-for-substring",
    source: "regression",
    ...HN,
    itemTitle: "Legit Forums Weekly",
    itemSummary: null,
    itemUrl: "https://example.com/legit-forums",
    expected: [],
    note: '"git for" once matched as a substring inside "leGIT FORums" and produced Software Engineering.',
  },
  {
    id: "regression-tech-strong-keyword",
    source: "regression",
    ...HN,
    itemTitle: "Fintech firm expands services",
    itemSummary: null,
    itemUrl: "https://example.com/fintech-firm",
    expected: [],
    note: '"tech" was a strong keyword until it was demoted to weakKeywords; bare "tech" alone must not classify.',
  },
  {
    id: "known-miss-hn-thin-title-zombie-energy",
    source: "regression",
    ...HN,
    itemTitle: 'Unearthing the Reality of "Zombie Energy Systems" in Africa\'s Energy Transition',
    itemSummary: null,
    itemUrl: "https://catf.us/resource/zombie-energy-systems-africa/",
    expected: [],
    note: "KNOWN keyword-classifier LIMITATION (screenshot in-session): 'energy' alone scores 3 vs ITEM_SCORE_THRESHOLD=4 with no domain hint. A human classifier would correctly answer Climate & Environment. When the embedding classifier lands, flip this expectation to ['Climate & Environment']; that flip is the receipt that the new classifier wins.",
  },
  {
    id: "regression-hn-git-with-host",
    source: "regression",
    ...HN,
    itemTitle: "Oak: Git for Agents",
    itemSummary: null,
    itemUrl: "https://github.com/oak/oak",
    expected: ["Software Engineering"],
    note: "Title 'git' + github.com domain hint clears the item threshold.",
  },
  {
    id: "regression-hn-git-without-host",
    source: "regression",
    ...HN,
    itemTitle: "Oak: Git for Agents",
    itemSummary: null,
    itemUrl: "https://oak.space/",
    expected: [],
    note: "Without a corroborating host or second keyword, a single 'git' title hit must abstain.",
  },
  {
    id: "regression-weak-words-alone",
    source: "regression",
    ...HN,
    itemTitle: "Company news app updates",
    itemSummary: null,
    itemUrl: "https://example.com/updates",
    expected: [],
    note: "Weak keywords ('company', 'news', 'app') alone must never trigger classification.",
  },
  {
    id: "regression-hn-security-privesc",
    source: "regression",
    ...HN,
    itemTitle: "MSI Center - How to gain SYSTEM privileges in seconds",
    itemSummary: "A local privilege escalation vulnerability lets attackers gain SYSTEM access.",
    itemUrl: "https://mrbruh.com/msi-center-privilege-escalation",
    expected: ["Security & Privacy"],
  },
  {
    id: "regression-hn-science-domain",
    source: "regression",
    ...HN,
    itemTitle: "Scientists discover guidance system for migratory songbirds",
    itemSummary: "Researchers describe neural circuits used for migration.",
    itemUrl: "https://news.exeter.ac.uk/songbirds-guidance-system",
    expected: ["Science & Research"],
  },
  {
    id: "regression-hn-ai-story",
    source: "regression",
    ...HN,
    itemTitle: "New open-weights language model released",
    itemSummary: "The transformer model uses embeddings trained by an autonomous agent pipeline.",
    itemUrl: "https://huggingface.co/blog/new-model",
    expected: ["AI & ML"],
  },
  {
    id: "regression-parent-feed-metadata-does-not-dilute",
    source: "regression",
    itemTitle: "A practical guide to pasta dough and weeknight cooking",
    itemSummary: "Chef notes on kitchen technique, recipe testing, and restaurant prep.",
    itemUrl: "https://seriouseats.com/pasta-dough-guide",
    feedTitle: "AI & ML Daily",
    feedDescription:
      "Language model, transformer, embedding, agent, and artificial intelligence analysis.",
    feedUrl: "https://example.com/rss",
    feedSiteUrl: "https://example.com",
    sourceKind: "rss",
    expected: ["Food & Travel"],
    note: "Parent feed metadata must never override an obviously off-topic item.",
  },
  {
    id: "regression-hn-thin-metasearch",
    source: "regression",
    ...HN,
    itemTitle: "SearXNG: A free internet metasearch engine",
    itemSummary: null,
    itemUrl: "https://docs.searxng.org/",
    expected: ["Technology"],
  },
  {
    id: "regression-hn-thin-changelog",
    source: "regression",
    ...HN,
    itemTitle: "Kagi Changelog",
    itemSummary: null,
    itemUrl: "https://kagi.com/changelog",
    expected: ["Technology"],
  },

  // - Real World Coverage -------------------------- Important
  {
    id: "field-zenesys-predictive-analytics-business",
    source: "field",
    feedTitle: "Zenesys Technosys Blogs",
    feedDescription: null,
    feedUrl: "https://zenesys.com/",
    feedSiteUrl: "https://zenesys.com/",
    sourceKind: "rss",
    itemTitle: "How Predictive Analytics Transforms Strategic Planning and Business Growth",
    itemSummary: null,
    itemContentText: null,
    itemUrl:
      "https://zenesys.com/how-predictive-analytics-transforms-strategic-planning-and-business-growth",
    expected: ["Business & Startups"],
  },
  {
    id: "field-seattle-mayor-city-budget",
    source: "field",
    feedTitle: "The Seattle Times Local Politics – The Seattle Times",
    feedDescription: "Seattle local-government, public-policy, and political reporting.",
    feedUrl: "https://www.seattletimes.com/seattle-news/politics/",
    feedSiteUrl: "https://www.seattletimes.com/",
    sourceKind: "rss",
    itemTitle: "Seattle mayor tries to ‘right the ship’ in her first city budget",
    itemSummary:
      "Seattle’s mayor proposed a city budget amid ongoing revenue and spending pressures.",
    itemContentText:
      "The mayor’s proposed city budget addresses revenue projections, city spending, public services, and municipal fiscal policy.",
    itemUrl:
      "https://www.seattletimes.com/seattle-news/politics/seattle-mayor-tries-to-right-the-ship-in-her-first-city-budget",
    expected: ["Politics & Policy"],
  },
  {
    id: "field-coronado-school-board-endorsement",
    source: "field",
    feedTitle: "Coronado Times",
    feedDescription: "Local Coronado news, community reporting, and election coverage.",
    feedUrl: "https://coronadotimes.com/",
    feedSiteUrl: "https://coronadotimes.com/",
    sourceKind: "rss",
    itemTitle: "Endorsement of Mal Sandie",
    itemSummary:
      "A paid political endorsement letter supports a candidate seeking reelection to a local school board.",
    itemContentText:
      "The letter discusses a school-board reelection campaign, public education, local governance, and asks voters to support the candidate.",
    itemUrl: "https://coronadotimes.com/news/2026/09/22/endorsement-of-mal-sandie",
    expected: ["Politics & Policy"],
  },
  {
    id: "field-texas-senate-election-runoff",
    source: "field",
    feedTitle: "Secretary of State Press Releases",
    feedDescription: "Official Texas election-administration notices and press releases.",
    feedUrl: "https://www.sos.state.tx.us/about/newsreleases/",
    feedSiteUrl: "https://www.sos.state.tx.us/",
    sourceKind: "rss",
    itemTitle: "Early voting starts for Texas Senate District 4 Special Election Runoff",
    itemSummary:
      "Texas voters in Senate District 4 are reminded of early-voting dates for a special-election runoff.",
    itemContentText:
      "The Texas Secretary of State announced early voting and voter-identification information for a Texas Senate District special-election runoff.",
    itemUrl: "https://www.sos.state.tx.us/about/newsreleases/2014/072414.shtml",
    expected: ["Politics & Policy"],
  },
  {
    id: "field-n1clc-amateur-radio",
    source: "field",
    feedTitle: "N1CLC",
    feedDescription: "Amateur radio, RF experimentation, and technology.",
    feedUrl: "https://n1clc.com/",
    feedSiteUrl: "https://n1clc.com/",
    sourceKind: "rss",
    itemTitle: "WELCOME",
    itemSummary:
      "An amateur radio blog covering ham radio, summits on the air, RF topics, and technology.",
    itemContentText:
      "Welcome to my amateur radio blog. I cover ham radio, SOTA, general RF geek topics, technology, and related projects.",
    itemUrl: "https://www.blogger.com/feeds/752422485457982901/posts/default/197035969749796849",
    expected: ["Technology"],
  },
  {
    id: "field-motorsport-street-race",
    source: "field",
    feedTitle: "Eventfinda » NZ Motorsport",
    feedDescription: "New Zealand motorsport events and race listings.",
    feedUrl: "https://www.eventfinda.co.nz/",
    feedSiteUrl: "https://www.eventfinda.co.nz/",
    sourceKind: "rss",
    itemTitle: "MS Motors Nelson Street Race",
    itemSummary:
      "An annual motorsport event attracting spectators and competitors from across New Zealand.",
    itemContentText:
      "The Nelson Street Race is an annual motorsport event with competitors and spectators.",
    itemUrl: "https://www.eventfinda.co.nz/2027/ms-motors-nelson-street-race/nelson-tasman",
    expected: ["Sports"],
  },
  {
    id: "field-visualist-art-workshop",
    source: "field",
    feedTitle: "The Visualist",
    feedDescription: "Art workshops, exhibitions, calendars, and creative events.",
    feedUrl: "https://thevisualist.org/",
    feedSiteUrl: "https://thevisualist.org/",
    sourceKind: "rss",
    itemTitle: "Documentation Workshops and Open Studios",
    itemSummary: "An art workshop helping artists photograph artwork for their portfolios.",
    itemContentText:
      "Art Documentation Open Studio provides artists with equipment and space to photograph artwork.",
    itemUrl: "https://thevisualist.org/?p=192845",
    expected: ["Culture & Media"],
  },
  {
    id: "field-hyndsight-time-series",
    source: "field",
    feedTitle: "Hyndsight",
    feedDescription: "Statistics, forecasting, econometrics, and academic research.",
    feedUrl: "https://robjhyndman.com/",
    feedSiteUrl: "https://robjhyndman.com/",
    sourceKind: "rss",
    itemTitle: "Surprises in time series analysis",
    itemSummary:
      "A seminar on a statistical framework for identifying anomalies in time-series data.",
    itemContentText:
      "A statistical research framework identifies anomalies in historical and real-time time series.",
    itemUrl: "https://robjhyndman.com/seminars/ts_surprises.html",
    expected: ["Science & Research"],
  },
  {
    id: "field-wisconsineye-clemency-board",
    source: "field",
    feedTitle: "WisconsinEye",
    feedDescription: "State government, public policy, and civic affairs coverage.",
    feedUrl: "https://wiseye.org/",
    feedSiteUrl: "https://wiseye.org/",
    sourceKind: "rss",
    itemTitle: "Governor’s Commutation Advisory Board – Part 2",
    itemSummary: "The Governor’s advisory board meets to consider applications for clemency.",
    itemContentText:
      "A state government commutation advisory board meeting considers clemency applications.",
    itemUrl: "https://wiseye.org/?p=33056",
    expected: ["Politics & Policy"],
  },
  {
    id: "field-vscode-insiders-release",
    source: "field",
    feedTitle: "Visual Studio Code - Code Editing. Redefined.",
    feedDescription: "Developer tooling and code editor updates.",
    feedUrl: "https://code.visualstudio.com/",
    feedSiteUrl: "https://code.visualstudio.com/",
    sourceKind: "rss",
    itemTitle: "Visual Studio Code 1.138 (Insiders)",
    itemSummary: "Learn what is new in Visual Studio Code 1.138 Insiders.",
    itemContentText:
      "Release notes for the Visual Studio Code development environment and code editor.",
    itemUrl: "https://code.visualstudio.com/updates/v1_138",
    expected: ["Software Engineering"],
  },
  {
    id: "field-techcrunch-ai-agents-google-home",
    source: "field",
    feedTitle: "TechCrunch",
    feedDescription: "Technology industry news and startup coverage.",
    feedUrl: "https://techcrunch.com/",
    feedSiteUrl: "https://techcrunch.com/",
    sourceKind: "rss",
    itemTitle: "Your AI agents can now control your Google Home devices",
    itemSummary:
      "Google is launching early access to an MCP server allowing AI agents to control connected home devices.",
    itemContentText:
      "AI agents including Claude and ChatGPT can control smart-home devices through a new MCP server.",
    itemUrl:
      "https://techcrunch.com/2026/09/16/your-ai-agents-can-now-control-your-google-home-devices",
    expected: ["AI & ML"],
  },
  {
    id: "field-cryptonews-stablecoin-payments",
    source: "field",
    feedTitle: "News - Cryptonews",
    feedDescription: "Cryptocurrency, financial markets, and digital-asset news.",
    feedUrl: "https://cryptonews.com/",
    feedSiteUrl: "https://cryptonews.com/",
    sourceKind: "rss",
    itemTitle: "Ripple Joins Velocity, Targets Payment Back End With $10 Million Extension",
    itemSummary:
      "Velocity raised funding for payments infrastructure linking stablecoins with banks and card networks.",
    itemContentText:
      "The company is building stablecoin payment infrastructure, settlement systems, and corporate treasury operations.",
    itemUrl: "https://cryptonews.com/news/velocity-ripple-payments-infrastructure-stablecoin-rails",
    expected: ["Finance & Markets"],
  },
  {
    id: "field-va-telehealth-pain",
    source: "field",
    feedTitle: "VA News",
    feedDescription: "Veterans healthcare and public-service news.",
    feedUrl: "https://news.va.gov/",
    feedSiteUrl: "https://news.va.gov/",
    sourceKind: "rss",
    itemTitle: "Virtual first step: How telehealth helped Navy Veteran manage chronic pain",
    itemSummary: "A Navy Veteran used telehealth to receive care for chronic back pain.",
    itemContentText:
      "Telehealth helped a veteran manage chronic pain and connect with healthcare providers.",
    itemUrl: "https://news.va.gov/149380/telehealth-helped-veteran-manage-chronic-pain",
    expected: ["Health & Medicine"],
  },
  {
    id: "field-bandwagon-awit-awards",
    source: "field",
    feedTitle: "Bandwagon",
    feedDescription: "Music, artists, and entertainment-industry news.",
    feedUrl: "https://www.bandwagon.asia/",
    feedSiteUrl: "https://www.bandwagon.asia/",
    sourceKind: "rss",
    itemTitle: "SB19, IV of Spades, Dionela, Ben&Ben, Lola Amour win big at 39th Awit Awards",
    itemSummary:
      "Filipino music artists were recognized across pop, rock, R&B, hip-hop, jazz, and folk.",
    itemContentText:
      "The Awit Awards recognized Filipino music artists and songs across multiple music genres.",
    itemUrl:
      "https://www.bandwagon.asia/articles/sb19-iv-of-spades-dionela-ben-ben-lola-amour-win-big-at-39th-awit-awards",
    expected: ["Culture & Media"],
  },

  // ── Category coverage: AI & ML ───────────────────────────────────────────────
  {
    id: "coverage-ai-positive",
    source: "coverage",
    ...HN,
    itemTitle: "Anthropic releases new Claude model with tool use",
    itemSummary:
      "The language model supports multi-step agent workflows and improved tool use for coding.",
    itemUrl: "https://www.anthropic.com/news/claude-4",
    expected: ["AI & ML"],
  },
  {
    id: "coverage-ai-adversarial",
    source: "coverage",
    ...HN,
    itemTitle: "Our AI-powered coffee shop is finally open",
    itemSummary: "The espresso machine uses machine learning to recommend beans.",
    itemUrl: "https://example.com/ai-coffee",
    expected: ["AI & ML"],
    note: "Adversarial: AI in a non-tech context should still tag AI when 'machine learning' is explicit in body.",
  },

  // ── Category coverage: Software Engineering ─────────────────────────────────
  {
    id: "coverage-swe-positive",
    source: "coverage",
    ...HN,
    itemTitle: "Refactoring our TypeScript backend to reduce database load",
    itemSummary:
      "How we redesigned our Postgres query layer and improved developer experience for our infrastructure team.",
    itemUrl: "https://medium.com/some-team/refactor",
    expected: ["Software Engineering"],
  },
  {
    id: "coverage-swe-adversarial",
    source: "coverage",
    ...HN,
    itemTitle: "The art of code review culture",
    itemSummary: null,
    itemUrl: "https://example.com/code-review",
    expected: ["Software Engineering"],
    note: "Thin summary; single word 'code' in title is not sufficient — abstention is acceptable if body is empty.",
  },

  // ── Category coverage: Security & Privacy ───────────────────────────────────
  {
    id: "coverage-security-positive",
    source: "coverage",
    ...HN,
    itemTitle: "Critical CVE in OpenSSL: patch immediately",
    itemSummary:
      "The vulnerability enables remote code execution; researchers warn of active exploitation and ransomware campaigns.",
    itemUrl: "https://bleepingcomputer.com/openssl-cve-2026",
    expected: ["Security & Privacy"],
  },
  {
    id: "coverage-security-adversarial",
    source: "coverage",
    ...HN,
    itemTitle: "How I secured my home Wi-Fi network",
    itemSummary: null,
    itemUrl: "https://personal-blog.example.com/wifi",
    expected: [],
    note: "Casual title without security-specific vocabulary should abstain.",
  },

  // ── Category coverage: Technology ───────────────────────────────────────────
  {
    id: "coverage-tech-positive",
    source: "coverage",
    ...HN,
    itemTitle: "New Apple silicon chip announced at hardware event",
    itemSummary:
      "The M5 chip brings improvements to laptops, tablets, and other consumer hardware from the technology company.",
    itemUrl: "https://arstechnica.com/apple-m5-chip",
    expected: ["Technology"],
  },
  {
    id: "coverage-tech-adversarial",
    source: "coverage",
    ...HN,
    itemTitle: "Fintech startup raises Series B",
    itemSummary: null,
    itemUrl: "https://example.com/fintech-b",
    expected: [],
    note: '"fintech" contains "tech" but is a finance/business story; classifier must not tag Technology.',
  },

  // ── Category coverage: Science & Research ───────────────────────────────────
  {
    id: "coverage-science-positive",
    source: "coverage",
    ...HN,
    itemTitle: "Astronomers detect gravitational waves from black hole merger",
    itemSummary:
      "The discovery marks a milestone in astronomy and physics research at the observatory.",
    itemUrl: "https://nature.com/gravitational-wave-2026",
    expected: ["Science & Research"],
  },
  {
    id: "coverage-science-adversarial",
    source: "coverage",
    ...HN,
    itemTitle: "Rocket Science: the game show",
    itemSummary: null,
    itemUrl: "https://example.com/game-show",
    expected: [],
    note: "Non-science topic that borrows the word 'science' idiomatically.",
  },

  // ── Category coverage: Business & Startups ──────────────────────────────────
  {
    id: "coverage-business-positive",
    source: "coverage",
    ...HN,
    itemTitle: "Startup raises $100M Series C to expand enterprise sales",
    itemSummary: "The venture-backed company reports growing revenue and business partnerships.",
    itemUrl: "https://techcrunch.com/startup-series-c",
    expected: ["Business & Startups"],
  },
  {
    id: "coverage-business-adversarial",
    source: "coverage",
    ...HN,
    itemTitle: "Business as usual for the coffee shop next door",
    itemSummary: null,
    itemUrl: "https://example.com/coffee-shop",
    expected: [],
    note: '"business" idiomatically, not a business story.',
  },

  // ── Category coverage: Finance & Markets ────────────────────────────────────
  {
    id: "coverage-finance-positive",
    source: "coverage",
    ...HN,
    itemTitle: "Bitcoin surges as inflation cools and stock market rebounds",
    itemSummary: "Investors rotated into crypto and finance assets amid the economic recovery.",
    itemUrl: "https://finance.yahoo.com/bitcoin-2026",
    expected: ["Finance & Markets"],
  },
  {
    id: "coverage-finance-adversarial",
    source: "coverage",
    ...HN,
    itemTitle: "The Farmers' Market opens this weekend",
    itemSummary: null,
    itemUrl: "https://example.com/farmers-market",
    expected: [],
    note: '"market" idiomatically, unrelated to financial markets.',
  },

  // ── Category coverage: Politics & Policy ────────────────────────────────────
  {
    id: "coverage-politics-positive",
    source: "coverage",
    ...HN,
    itemTitle: "Congress debates new AI regulation bill ahead of election",
    itemSummary:
      "The proposed policy would require government oversight of frontier language models; the president has signaled support.",
    itemUrl: "https://politico.com/ai-regulation-bill",
    expected: ["Politics & Policy", "AI & ML"],
    note: "Legitimately dual-tagged — AI regulation is both.",
  },
  {
    id: "coverage-politics-adversarial",
    source: "coverage",
    ...HN,
    itemTitle: "Office politics at the local bakery",
    itemSummary: null,
    itemUrl: "https://example.com/bakery-drama",
    expected: [],
  },

  // ── Category coverage: World & Society ──────────────────────────────────────
  {
    id: "coverage-world-positive",
    source: "coverage",
    ...HN,
    itemTitle: "Breaking: international summit produces new treaty on climate",
    itemSummary:
      "World leaders convened for headline-making talks on society and environmental policy.",
    itemUrl: "https://reuters.com/climate-treaty-2026",
    expected: ["World & Society", "Climate & Environment"],
  },

  // ── Category coverage: Culture & Media ──────────────────────────────────────
  {
    id: "coverage-culture-positive",
    source: "coverage",
    ...HN,
    itemTitle: "How a small indie film became the year's biggest cultural moment",
    itemSummary: "The director's writing and music choices reshape how art meets streaming.",
    itemUrl: "https://newyorker.com/indie-film-2026",
    expected: ["Culture & Media"],
  },

  // ── Category coverage: Design & UX ──────────────────────────────────────────
  {
    id: "coverage-design-positive",
    source: "coverage",
    ...HN,
    itemTitle: "Rethinking Figma's product design for a mobile-first user experience",
    itemSummary:
      "The redesign emphasizes typography, visual hierarchy, and cleaner interface patterns for UX designers.",
    itemUrl: "https://figma.com/blog/mobile-first-redesign",
    expected: ["Design & UX"],
  },

  // ── Category coverage: Health & Medicine ────────────────────────────────────
  {
    id: "coverage-health-positive",
    source: "coverage",
    ...HN,
    itemTitle: "New vaccine trial shows promise for patients with rare disease",
    itemSummary: "The clinical drug study, led by NIH doctors, reports strong medical outcomes.",
    itemUrl: "https://nih.gov/vaccine-trial-2026",
    expected: ["Health & Medicine"],
  },

  // ── Category coverage: Climate & Environment ────────────────────────────────
  {
    id: "coverage-climate-positive",
    source: "coverage",
    ...HN,
    itemTitle: "Emissions from renewable energy shift accelerate climate goals",
    itemSummary:
      "The sustainability report shows environmental gains from renewable investment in the energy sector.",
    itemUrl: "https://carbonbrief.org/emissions-report-2026",
    expected: ["Climate & Environment"],
  },

  // ── Category coverage: Education & Work ─────────────────────────────────────
  {
    id: "coverage-education-positive",
    source: "coverage",
    ...HN,
    itemTitle: "Teachers reshape the classroom curriculum for students in the AI era",
    itemSummary:
      "Educators reflect on career pathways and workplace preparation in modern education.",
    itemUrl: "https://chronicle.com/curriculum-2026",
    expected: ["Education & Work"],
  },

  // ── Category coverage: Sports ───────────────────────────────────────────────
  {
    id: "coverage-sports-positive",
    source: "coverage",
    ...HN,
    itemTitle: "Local team wins baseball league championship in extra innings",
    itemSummary: "The nail-biting match capped a season of dominant football-adjacent play.",
    itemUrl: "https://espn.com/baseball-2026",
    expected: ["Sports"],
  },

  // ── Category coverage: Food & Travel ────────────────────────────────────────
  {
    id: "coverage-food-positive",
    source: "coverage",
    ...HN,
    itemTitle: "Chef shares favorite baking recipes from a weeklong Italy trip",
    itemSummary:
      "The restaurant tour covers hotel-hopping, flight delays, and the best food in Tuscany.",
    itemUrl: "https://bonappetit.com/italy-baking-2026",
    expected: ["Food & Travel"],
  },

  // ── Category coverage: Personal & Essays ────────────────────────────────────
  {
    id: "coverage-personal-positive",
    source: "coverage",
    ...HN,
    itemTitle: "Diary of a first-time father: a personal memoir",
    itemSummary: "A reflection on parenthood written as a series of essay-style diary entries.",
    itemUrl: "https://lithub.com/first-time-father-essay",
    expected: ["Personal & Essays"],
  },
];

/**
 * A "category card" is the semantic counterpart to `CATEGORY_TAXONOMY`'s keyword lists: a
 * short description plus a handful of representative titles, embedded once at worker
 * startup and compared against each article's embedding via cosine similarity. Unlike a
 * single label embedding (too thin — "Technology" alone carries little signal), multiple
 * prototypes per category let the classifier recognize a topic from several angles (e.g.
 * Security & Privacy covers both "CVE disclosure" and "surveillance policy" phrasing).
 *
 * `label`/`slug` must match a `CATEGORY_TAXONOMY` entry — the embedding classifier scores
 * against the same canonical category set as the keyword classifier, just via a different
 * mechanism. Titles here are representative real-world headlines, not fixture data; keep
 * them topically unambiguous so a card's own prototypes don't science its own similarity
 * comparison against a neighboring category.
 */
export type CategoryCard = {
  label: string;
  slug: string;
  description: string;
  representativeTitles: readonly string[];
};

export const CATEGORY_CARDS: readonly CategoryCard[] = [
  {
    label: "Software Engineering",
    slug: "software-engineering",
    description:
      "Software development practice: programming languages, frameworks, architecture, version control, backend/frontend engineering, developer tools, and infrastructure.",
    representativeTitles: [
      "Refactoring our TypeScript backend to reduce database load",
      "Git for Agents: a version-control tool built for AI coding workflows",
      "How Kubernetes changed the way we deploy microservices",
      "A practical guide to database indexing strategies",
    ],
  },
  {
    label: "Technology",
    slug: "technology",
    description:
      "Consumer and enterprise technology products: hardware, chips, gadgets, search engines, platforms, and general tech industry coverage that isn't specifically about software engineering, AI, or security.",
    representativeTitles: [
      "New Apple silicon chip announced at hardware event",
      "SearXNG: a free internet metasearch engine",
      "Kagi Changelog: new search filters and privacy features",
      "The rise of foldable phone hardware in 2026",
    ],
  },
  {
    label: "Security & Privacy",
    slug: "security-privacy",
    description:
      "Cybersecurity, data breaches, vulnerabilities, exploits, malware, ransomware, privacy rights, and surveillance.",
    representativeTitles: [
      "Critical CVE in OpenSSL: patch immediately",
      "MSI Center: how to gain SYSTEM privileges in seconds",
      "How a ransomware gang breached a hospital network",
      "New privacy law restricts data broker surveillance practices",
    ],
  },
  {
    label: "AI & ML",
    slug: "ai-ml",
    description:
      "Artificial intelligence and machine learning: language models, neural networks, embeddings, transformers, AI agents, and research from labs like OpenAI or Anthropic.",
    representativeTitles: [
      "Anthropic releases new Claude model with tool use",
      "New open-weights language model released with improved reasoning",
      "How transformer architectures changed natural language processing",
      "An autonomous AI agent pipeline for coding tasks",
    ],
  },
  {
    label: "Science & Research",
    slug: "science-research",
    description:
      "Scientific discovery and academic research: physics, biology, astronomy, space exploration, and peer-reviewed findings, excluding AI/ML research specifically.",
    representativeTitles: [
      "Astronomers detect gravitational waves from black hole merger",
      "Scientists discover guidance system for migratory songbirds",
      "New physics experiment challenges standard model predictions",
      "Researchers map neural circuits behind memory formation",
    ],
  },
  {
    label: "Business & Startups",
    slug: "business-startups",
    description:
      "Startup funding, venture capital, company launches, business strategy, and entrepreneurship.",
    representativeTitles: [
      "Startup raises $100M Series C to expand enterprise sales",
      "Why this founder pivoted after failing twice",
      "Venture capital funding slows in the enterprise SaaS market",
      "How a two-person startup became a unicorn",
    ],
  },
  {
    label: "Finance & Markets",
    slug: "finance-markets",
    description:
      "Financial markets, investing, banking, cryptocurrency, economic indicators, and personal finance.",
    representativeTitles: [
      "Bitcoin surges as inflation cools and stock market rebounds",
      "Federal Reserve signals interest rate cut amid economic slowdown",
      "How index funds outperform actively managed portfolios",
      "Crypto exchange faces regulatory scrutiny over reserves",
    ],
  },
  {
    label: "Politics & Policy",
    slug: "politics-policy",
    description: "Government, legislation, elections, regulation, and public policy debates.",
    representativeTitles: [
      "Congress debates new AI regulation bill ahead of election",
      "Supreme Court ruling reshapes federal regulatory authority",
      "Local election results signal shift in voter priorities",
      "New trade policy sparks diplomatic tension",
    ],
  },
  {
    label: "World & Society",
    slug: "world-society",
    description:
      "International news, breaking headlines, and broad societal issues covered by general news outlets, distinct from a specific policy debate or scientific finding.",
    representativeTitles: [
      "Breaking: international summit produces new treaty on climate",
      "World leaders convene for emergency talks after natural disaster",
      "A look at demographic shifts reshaping cities worldwide",
      "How a community rebuilt after a devastating flood",
    ],
  },
  {
    label: "Culture & Media",
    slug: "culture-media",
    description:
      "Film, music, books, art, television, podcasts, and the broader creative and entertainment industries.",
    representativeTitles: [
      "How a small indie film became the year's biggest cultural moment",
      "The best podcasts of the year, according to critics",
      "Inside the making of a bestselling novel",
      "A retrospective on the album that defined a genre",
    ],
  },
  {
    label: "Design & UX",
    slug: "design-ux",
    description:
      "User experience design, interface design, product design, typography, and visual design practice.",
    representativeTitles: [
      "Rethinking Figma's product design for a mobile-first user experience",
      "Why good typography matters more than you think",
      "A case study in redesigning a checkout flow to reduce drop-off",
      "The evolution of dark mode interface design",
    ],
  },
  {
    label: "Health & Medicine",
    slug: "health-medicine",
    description:
      "Medical research, clinical trials, public health, disease treatment, and healthcare policy.",
    representativeTitles: [
      "New vaccine trial shows promise for patients with rare disease",
      "How a new drug is changing treatment for chronic pain",
      "Public health officials warn of rising respiratory illness cases",
      "A clinical study links sleep quality to long-term heart health",
    ],
  },
  {
    label: "Climate & Environment",
    slug: "climate-environment",
    description:
      "Climate change, renewable energy, environmental sustainability, emissions, and ecological research — including energy infrastructure and energy transition topics.",
    representativeTitles: [
      "Unearthing the reality of zombie energy systems in Africa's energy transition",
      "Emissions from renewable energy shift accelerate climate goals",
      "How outdated electrical grids are holding back the energy transition",
      "A new study links extreme weather patterns to global warming",
    ],
  },
  {
    label: "Education & Work",
    slug: "education-work",
    description:
      "Schools, universities, curricula, workplace culture, career development, and the future of work.",
    representativeTitles: [
      "Teachers reshape the classroom curriculum for students in the AI era",
      "How remote work changed career advancement expectations",
      "A university pilots a new approach to STEM education",
      "Why workplace burnout is rising among knowledge workers",
    ],
  },
  {
    label: "Sports",
    slug: "sports",
    description: "Professional and amateur sports: games, leagues, athletes, and sports business.",
    representativeTitles: [
      "Local team wins baseball league championship in extra innings",
      "A rookie quarterback's breakout season reshapes the playoff picture",
      "How analytics transformed basketball strategy",
      "The business behind a major sports league's new media deal",
    ],
  },
  {
    label: "Food & Travel",
    slug: "food-travel",
    description: "Cooking, restaurants, recipes, travel destinations, hotels, and tourism.",
    representativeTitles: [
      "Chef shares favorite baking recipes from a weeklong Italy trip",
      "The best hidden restaurants in a city known for its food scene",
      "A guide to budget travel across Southeast Asia",
      "How a small-batch bakery became a local institution",
    ],
  },
  {
    label: "Personal & Essays",
    slug: "personal-essays",
    description:
      "First-person essays, memoirs, personal reflections, and diary-style writing not tied to a specific news topic.",
    representativeTitles: [
      "Diary of a first-time father: a personal memoir",
      "What I learned from a year of living alone",
      "An essay on grief, memory, and moving forward",
      "Reflections on leaving a career behind to travel",
    ],
  },
  // Miscellaneous deliberately has no card: it is a low-confidence fallback the caller
  // applies when nothing else clears the similarity threshold (mirroring the keyword
  // classifier's `allowGeneralFallback`), not a peer topic a title can cosine-match against.
  // A "general updates" prototype would compete on equal footing with every real category
  // and win comparisons it has no business winning.
];

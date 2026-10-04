import type { ClassifierEvalCase } from "./classifier-eval-fixture";

/**
 * Held-out field cases: real-world headlines a classifier missed, scored on their own. Never
 * write category-card prototypes from these cases, or the embedding eval stops measuring
 * generalization.
 */
export const CLASSIFIER_EVAL_FIELD_CASES: readonly ClassifierEvalCase[] = [
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
];

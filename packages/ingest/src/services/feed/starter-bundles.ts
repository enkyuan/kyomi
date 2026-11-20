// Shared feed catalog for onboarding and its browser preview.
export const starterBundles = [
  {
    id: "technology",
    title: "Technology",
    feeds: [
      {
        title: "Ars Technica",
        url: "https://feeds.arstechnica.com/arstechnica/index",
        siteUrl: "https://arstechnica.com",
      },
      {
        title: "The Cloudflare Blog",
        url: "https://blog.cloudflare.com/rss/",
        siteUrl: "https://blog.cloudflare.com",
      },
      {
        title: "The GitHub Blog",
        url: "https://github.blog/feed/",
        siteUrl: "https://github.blog",
      },
      {
        title: "EFF Updates",
        url: "https://www.eff.org/rss/updates.xml",
        siteUrl: "https://www.eff.org",
      },
    ],
  },
  {
    id: "science",
    title: "Science",
    feeds: [
      {
        title: "Quanta Magazine",
        url: "https://www.quantamagazine.org/feed/",
        siteUrl: "https://www.quantamagazine.org",
      },
      {
        title: "Science News",
        url: "https://www.sciencenews.org/feed",
        siteUrl: "https://www.sciencenews.org",
      },
      {
        title: "NASA",
        url: "https://www.nasa.gov/feed/",
        siteUrl: "https://www.nasa.gov",
      },
      {
        title: "ScienceDaily",
        url: "https://www.sciencedaily.com/rss/top/science.xml",
        siteUrl: "https://www.sciencedaily.com",
      },
    ],
  },
  {
    id: "design",
    title: "Design",
    feeds: [
      {
        title: "A List Apart",
        url: "https://alistapart.com/main/feed",
        siteUrl: "https://alistapart.com",
      },
      {
        title: "Smashing Magazine",
        url: "https://www.smashingmagazine.com/feed",
        siteUrl: "https://www.smashingmagazine.com",
      },
      {
        title: "Nielsen Norman Group",
        url: "https://www.nngroup.com/feed/rss",
        siteUrl: "https://www.nngroup.com",
      },
      {
        title: "Fast Company Design",
        url: "https://www.fastcompany.com/section/design/rss",
        siteUrl: "https://www.fastcompany.com",
      },
    ],
  },
  {
    id: "climate",
    title: "Climate & environment",
    feeds: [
      {
        title: "Carbon Brief",
        url: "https://www.carbonbrief.org/feed",
        siteUrl: "https://www.carbonbrief.org",
      },
      {
        title: "Grist",
        url: "https://grist.org/feed",
        siteUrl: "https://grist.org",
      },
      {
        title: "Inside Climate News",
        url: "https://insideclimatenews.org/feed",
        siteUrl: "https://insideclimatenews.org",
      },
      {
        title: "Climate Home News",
        url: "https://www.climatechangenews.com/feed",
        siteUrl: "https://www.climatechangenews.com",
      },
    ],
  },
  {
    id: "culture",
    title: "Arts & culture",
    feeds: [
      {
        title: "Literary Hub",
        url: "https://lithub.com/feed",
        siteUrl: "https://lithub.com",
      },
      {
        title: "The Paris Review",
        url: "https://www.theparisreview.org/blog/feed",
        siteUrl: "https://www.theparisreview.org",
      },
      {
        title: "Open Culture",
        url: "https://www.openculture.com/feed",
        siteUrl: "https://www.openculture.com",
      },
      {
        title: "Nieman Lab",
        url: "https://www.niemanlab.org/feed",
        siteUrl: "https://www.niemanlab.org",
      },
    ],
  },
  {
    id: "business",
    title: "Tech & business",
    feeds: [
      {
        title: "Stratechery",
        url: "https://stratechery.com/feed",
        siteUrl: "https://stratechery.com",
      },
      {
        title: "SaaStr",
        url: "https://www.saastr.com/feed",
        siteUrl: "https://www.saastr.com",
      },
      {
        title: "Platformer",
        url: "https://www.platformer.news/rss",
        siteUrl: "https://www.platformer.news",
      },
      {
        title: "O’Reilly Radar",
        url: "https://www.oreilly.com/radar/feed",
        siteUrl: "https://www.oreilly.com",
      },
    ],
  },
] as const;

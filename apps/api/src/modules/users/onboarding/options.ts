export const bundles = [
  {
    id: "technology",
    title: "Technology",
    feeds: [
      { title: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
      { title: "The Cloudflare Blog", url: "https://blog.cloudflare.com/rss/" },
      { title: "The GitHub Blog", url: "https://github.blog/feed/" },
      { title: "EFF Updates", url: "https://www.eff.org/rss/updates.xml" },
    ],
  },
  {
    id: "science",
    title: "Science",
    feeds: [
      { title: "Quanta Magazine", url: "https://www.quantamagazine.org/feed/" },
      { title: "Science News", url: "https://www.sciencenews.org/feed" },
      { title: "NASA", url: "https://www.nasa.gov/feed/" },
      { title: "ScienceDaily", url: "https://www.sciencedaily.com/rss/top/science.xml" },
    ],
  },
] as const;

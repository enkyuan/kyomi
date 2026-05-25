import { describe, expect, test } from "bun:test";
import { parseFeedMetadata } from "@modules/discover/feed/parse";

describe("parseFeedMetadata", () => {
  test("parses minimal RSS 2.0", () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>My &#8216;Blog&#8217;</title><link>https://blog.example/</link><description>Desc &amp; more</description><image><url>/icon.png</url></image></channel></rss>`;
    const meta = parseFeedMetadata(xml, "https://fallback/");
    expect(meta.title).toBe("My ‘Blog’");
    expect(meta.link).toBe("https://blog.example/");
    expect(meta.description).toBe("Desc & more");
    expect(meta.iconUrl).toBe("https://fallback/icon.png");
  });

  test("parses JSON Feed", () => {
    const json = JSON.stringify({
      version: "https://jsonfeed.org/version/1",
      title: "JSON site",
      description: "About",
      home_page_url: "https://json.example/",
      favicon: "/favicon.ico",
    });
    const meta = parseFeedMetadata(json, "https://fallback/");
    expect(meta.title).toBe("JSON site");
    expect(meta.link).toBe("https://json.example/");
    expect(meta.iconUrl).toBe("https://fallback/favicon.ico");
  });

  test("parses Atom icon and logo metadata", () => {
    const xml = `<?xml version="1.0"?><feed><title>Atom site</title><subtitle>Updates</subtitle><link href="https://atom.example/" rel="alternate"/><icon>/atom-icon.png</icon><logo>/logo.png</logo></feed>`;
    const meta = parseFeedMetadata(xml, "https://feeds.example/atom.xml");
    expect(meta.title).toBe("Atom site");
    expect(meta.link).toBe("https://atom.example/");
    expect(meta.iconUrl).toBe("https://feeds.example/atom-icon.png");
  });
});

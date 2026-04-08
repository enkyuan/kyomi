import { describe, expect, test } from "bun:test";
import { parseFeedMetadata } from "./discover.parse-feed";

describe("parseFeedMetadata", () => {
  test("parses minimal RSS 2.0", () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>My Blog</title><link>https://blog.example/</link><description>Desc</description></channel></rss>`;
    const meta = parseFeedMetadata(xml, "https://fallback/");
    expect(meta.title).toBe("My Blog");
    expect(meta.link).toBe("https://blog.example/");
    expect(meta.description).toBe("Desc");
  });

  test("parses JSON Feed", () => {
    const json = JSON.stringify({
      version: "https://jsonfeed.org/version/1",
      title: "JSON site",
      description: "About",
      home_page_url: "https://json.example/",
    });
    const meta = parseFeedMetadata(json, "https://fallback/");
    expect(meta.title).toBe("JSON site");
    expect(meta.link).toBe("https://json.example/");
  });
});

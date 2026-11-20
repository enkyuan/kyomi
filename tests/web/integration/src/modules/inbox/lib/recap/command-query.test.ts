import { describe, expect, test } from "vitest";
import { matchesRecapTerm, parseRecapPaletteQuery } from "@modules/inbox/lib/recap/command-query";

describe("recap command menu query", () => {
  test("empty and plain text", () => {
    expect(parseRecapPaletteQuery("")).toEqual({ kind: "empty" });
    expect(parseRecapPaletteQuery("   ")).toEqual({ kind: "empty" });
    expect(parseRecapPaletteQuery("  rust async ")).toEqual({ kind: "text", term: "rust async" });
  });

  test("a slash, or a command still being typed, suggests commands", () => {
    expect(parseRecapPaletteQuery("/")).toEqual({ kind: "commands", partial: "" });
    expect(parseRecapPaletteQuery("/Fe")).toEqual({ kind: "commands", partial: "fe" });
    // Typed in full but without the space yet: still a suggestion, so Enter completes it.
    expect(parseRecapPaletteQuery("/feeds")).toEqual({ kind: "commands", partial: "feeds" });
  });

  test("a command and a space scopes the search", () => {
    expect(parseRecapPaletteQuery("/feeds hacker")).toEqual({
      kind: "command",
      command: "feeds",
      term: "hacker",
    });
    expect(parseRecapPaletteQuery("/articles ")).toEqual({
      kind: "command",
      command: "articles",
      term: "",
    });
    expect(parseRecapPaletteQuery("/FOLDERS  Reading list")).toEqual({
      kind: "command",
      command: "folders",
      term: "Reading list",
    });
  });

  test("an unknown command is just text", () => {
    expect(parseRecapPaletteQuery("/nope thing")).toEqual({ kind: "text", term: "/nope thing" });
  });

  test("matches case-insensitively and an empty term matches everything", () => {
    expect(matchesRecapTerm("Hacker News", "hack")).toBe(true);
    expect(matchesRecapTerm("Hacker News", "zzz")).toBe(false);
    expect(matchesRecapTerm(null, "")).toBe(true);
    expect(matchesRecapTerm(undefined, "a")).toBe(false);
  });
});

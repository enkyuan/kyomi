import { describe, expect, test } from "vitest";
import { detectCodeLanguage } from "@/features/reader/code-language";

describe("detectCodeLanguage", () => {
  test("uses explicit language when present", () => {
    const result = detectCodeLanguage("hello(world);", "language-js".replace("language-", ""));
    expect(result).toEqual({
      language: "javascript",
      label: "JavaScript",
      confidence: "explicit",
      reason: "explicit language from code class",
    });
  });

  test("keeps unknown explicit language as explicit", () => {
    const result = detectCodeLanguage('{"hello":"world"}', "foo");
    expect(result.language).toBe("foo");
    expect(result.label).toBe("Foo");
    expect(result.confidence).toBe("explicit");
  });

  test("detects valid JSON deterministically", () => {
    const result = detectCodeLanguage('{"name":"cronos","enabled":true}');
    expect(result.language).toBe("json");
    expect(result.confidence).toBe("deterministic");
  });

  test("detects shell code from shebang deterministically", () => {
    const result = detectCodeLanguage(`#!/usr/bin/env bash
set -euo pipefail
for f in *.ts; do
  echo "$f"
done`);
    expect(result.language).toBe("bash");
    expect(result.label).toBe("Bash");
    expect(result.confidence).toBe("deterministic");
  });

  test("falls back to plain text for ambiguous snippets", () => {
    const result = detectCodeLanguage("hello(world);");
    expect(result).toEqual({
      language: "plaintext",
      label: "Plain text",
      confidence: "plain",
      reason: "no deterministic language signature matched",
    });
  });
});

import { expect } from "bun:test";

const CHARS = 200_000;

/**
 * Attacker-shaped text, about 200k characters each. Publishers control feed XML/HTML and signed-in
 * users control clip bodies, and every scan over them runs on the single server thread. The
 * quadratic regexes these replaced took 2-15 s on the unterminated-opener shapes; linear scans take
 * about 10 ms.
 */
export const hostileInputs: Readonly<Record<string, string>> = {
  "'<' x 200k": "<".repeat(CHARS),
  "'<a' x 100k": "<a".repeat(CHARS / 2),
  "'<head>' x 40k": "<head>".repeat(40_000),
  "'<link' x 40k": "<link".repeat(40_000),
  "'<meta' x 40k": "<meta".repeat(40_000),
  "'<title>' x 30k": "<title>".repeat(30_000),
  "'<article>' x 22k": "<article>".repeat(22_000),
  "'<script' x 30k": "<script".repeat(30_000),
  "'<script>' x 25k": "<script>".repeat(25_000),
  "'</p><p' x 33k": "</p><p".repeat(33_000),
  "newline x 200k": "\n".repeat(CHARS),
  "space-newline x 100k": " \n".repeat(CHARS / 2),
  "carriage return x 200k": "\r".repeat(CHARS),
  "'a' + carriage return x 100k": "a\r".repeat(CHARS / 2),
  "code fence x 50k": "```\n".repeat(50_000),
  "'[' x 200k": "[".repeat(CHARS),
  "'![' x 100k": "![".repeat(CHARS / 2),
  "'[a](x' x 40k": "[a](x".repeat(40_000),
  "table row then blank lines": `|a|${"\n".repeat(CHARS)}x`,
  "heading then spaces": `#${" ".repeat(CHARS)}\n`,
  "setext underline then spaces": `a\n=${" ".repeat(CHARS)}x`,
};

/** Generous for a busy CI host: linear runs measure about 10 ms, quadratic ones seconds. */
const LINEAR_BUDGET_MS = 500;

export function expectLinear(run: () => unknown): void {
  const startedAt = performance.now();
  run();
  expect(performance.now() - startedAt).toBeLessThan(LINEAR_BUDGET_MS);
}

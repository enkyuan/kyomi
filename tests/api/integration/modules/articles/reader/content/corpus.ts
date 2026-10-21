import { JSDOM } from "jsdom";

/**
 * Reader fidelity corpus: raw article bodies, authored checks for the sanitizer v2 contract, and a
 * recorded baseline per sanitizer version. See `tests/api/fixtures/articles/corpus/README.md`.
 */

export const CORPUS_DIR = new URL("../../../../../fixtures/articles/corpus/", import.meta.url);

/** Set to `1` to rewrite the baseline for the current sanitizer version instead of comparing. */
export const UPDATE_CORPUS_ENV = "KYOMI_UPDATE_READER_CORPUS";

export type CorpusCheck =
  | { id: string; assert: "present" | "absent"; selector: string }
  | { id: string; assert: "text" | "no-text"; value: string };

export type CorpusFixture = {
  name: string;
  archetype: string;
  baseUrl: string;
  title: string;
  checks: CorpusCheck[];
};

export type CorpusReport = {
  sanitizerVersion: string;
  summary: { passed: number; total: number };
  fixtures: Record<string, { passed: number; total: number; checks: Record<string, boolean> }>;
};

export async function loadCorpusManifest(): Promise<CorpusFixture[]> {
  const manifest = (await Bun.file(new URL("manifest.json", CORPUS_DIR)).json()) as {
    fixtures: CorpusFixture[];
  };
  return manifest.fixtures;
}

export function readFixtureHtml(name: string): Promise<string> {
  return Bun.file(new URL(`html/${name}.html`, CORPUS_DIR)).text();
}

export function baselineUrl(sanitizerVersion: string, file: string): URL {
  return new URL(`baseline/${sanitizerVersion}/${file}`, CORPUS_DIR);
}

function normalizedText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function evaluateChecks(html: string, checks: CorpusCheck[]): Record<string, boolean> {
  const { document } = new JSDOM(`<!doctype html><body>${html}</body>`).window;
  const text = normalizedText(document.body.textContent ?? "");
  const results: Record<string, boolean> = {};

  for (const check of checks) {
    switch (check.assert) {
      case "present":
        results[check.id] = document.body.querySelector(check.selector) !== null;
        break;
      case "absent":
        results[check.id] = document.body.querySelector(check.selector) === null;
        break;
      case "text":
        results[check.id] = text.includes(normalizedText(check.value));
        break;
      case "no-text":
        results[check.id] = !text.includes(normalizedText(check.value));
        break;
    }
  }

  return results;
}

export function buildCorpusReport(
  sanitizerVersion: string,
  results: { name: string; checks: Record<string, boolean> }[],
): CorpusReport {
  const fixtures: CorpusReport["fixtures"] = {};
  let passed = 0;
  let total = 0;

  for (const result of results) {
    const values = Object.values(result.checks);
    const fixturePassed = values.filter(Boolean).length;
    fixtures[result.name] = {
      passed: fixturePassed,
      total: values.length,
      checks: result.checks,
    };
    passed += fixturePassed;
    total += values.length;
  }

  return { sanitizerVersion, summary: { passed, total }, fixtures };
}

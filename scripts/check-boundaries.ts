import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const SOURCE_ROOTS = [
  "apps/api/src",
  "apps/mobile/src",
  "apps/web/src",
  "packages/worker/src",
  "packages/ui/src",
  "packages/db/src",
  "packages/reader/src",
];
const IMPORT_RE = /\bfrom\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

export type Violation = {
  file: string;
  specifier: string;
  reason: string;
};

function walk(root: string, dir: string): string[] {
  const fullDir = join(root, dir);
  const entries = readdirSync(fullDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const full = join(fullDir, entry.name);
    const rel = relative(root, full);
    if (entry.isDirectory()) {
      files.push(...walk(root, rel));
    } else if (entry.isFile() && /\.(ts|tsx|mts|cts)$/.test(entry.name)) {
      files.push(rel);
    }
  }

  return files;
}

function rootExists(root: string, path: string): boolean {
  try {
    return statSync(join(root, path)).isDirectory();
  } catch {
    return false;
  }
}

function collectImports(root: string, file: string): string[] {
  const source = readFileSync(join(root, file), "utf8");
  const imports: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const specifier = match[1] ?? match[2];
    if (specifier) imports.push(specifier);
  }
  return imports;
}

function checkFile(root: string, file: string): Violation[] {
  const violations: Violation[] = [];
  const isPackageFile = file.startsWith("packages/");
  const isWorkerFile = file.startsWith("packages/worker/");
  const isRouteFile = file.startsWith("apps/api/src/modules/") && file.endsWith(".routes.ts");

  for (const specifier of collectImports(root, file)) {
    if (
      isPackageFile &&
      (specifier.startsWith("apps/") ||
        specifier.startsWith("@modules/") ||
        specifier.startsWith("@adapters/") ||
        specifier.startsWith("@shared/"))
    ) {
      violations.push({ file, specifier, reason: "packages must not import app internals" });
    }
    if (specifier.includes("/src/") && specifier.startsWith("@kyomi/")) {
      violations.push({
        file,
        specifier,
        reason: "import packages through public exports, not /src internals",
      });
    }
    if (
      isWorkerFile &&
      (specifier.startsWith("@modules/") ||
        specifier.startsWith("@adapters/") ||
        specifier.startsWith("@shared/") ||
        specifier.startsWith("@kyomi/api"))
    ) {
      violations.push({ file, specifier, reason: "worker must not import API/http modules" });
    }
    if (isRouteFile && specifier.includes("/src/") && specifier.startsWith("@kyomi/")) {
      violations.push({
        file,
        specifier,
        reason: "route handlers must not import package internals",
      });
    }
  }

  return violations;
}

function sourceFiles(root: string): string[] {
  return SOURCE_ROOTS.filter((path) => rootExists(root, path)).flatMap((path) => walk(root, path));
}

export function checkBoundaries(root = process.cwd()): Violation[] {
  return sourceFiles(root).flatMap((file) => checkFile(root, file));
}

if (import.meta.main) {
  const root = process.cwd();
  const violations = checkBoundaries(root);

  if (violations.length > 0) {
    console.error("Import boundary violations:");
    for (const violation of violations) {
      console.error(`- ${violation.file}: ${violation.specifier} (${violation.reason})`);
    }
    process.exit(1);
  }

  console.log(`Import boundaries OK (${sourceFiles(root).length} files checked).`);
}

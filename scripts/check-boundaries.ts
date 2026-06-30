import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SOURCE_ROOTS = ["apps/api/src", "apps/web/src", "packages/worker/src", "packages/ui/src"];
const IMPORT_RE = /\bfrom\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

type Violation = {
  file: string;
  specifier: string;
  reason: string;
};

function walk(dir: string): string[] {
  const fullDir = join(ROOT, dir);
  const entries = readdirSync(fullDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const full = join(fullDir, entry.name);
    const rel = relative(ROOT, full);
    if (entry.isDirectory()) {
      files.push(...walk(rel));
    } else if (entry.isFile() && /\.(ts|tsx|mts|cts)$/.test(entry.name)) {
      files.push(rel);
    }
  }

  return files;
}

function rootExists(path: string): boolean {
  try {
    return statSync(join(ROOT, path)).isDirectory();
  } catch {
    return false;
  }
}

function collectImports(file: string): string[] {
  const source = readFileSync(join(ROOT, file), "utf8");
  const imports: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const specifier = match[1] ?? match[2];
    if (specifier) {
      imports.push(specifier);
    }
  }
  return imports;
}

function checkFile(file: string): Violation[] {
  const imports = collectImports(file);
  const violations: Violation[] = [];
  const isPackageFile = file.startsWith("packages/");
  const isWorkerFile = file.startsWith("packages/worker/");
  const isRouteFile = file.startsWith("apps/api/src/modules/") && file.endsWith(".routes.ts");

  for (const specifier of imports) {
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

const files = SOURCE_ROOTS.filter(rootExists).flatMap(walk);
const violations = files.flatMap(checkFile);

if (violations.length > 0) {
  console.error("Import boundary violations:");
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.specifier} (${violation.reason})`);
  }
  process.exit(1);
}

console.log(`Import boundaries OK (${files.length} files checked).`);

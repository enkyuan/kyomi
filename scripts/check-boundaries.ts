import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";

export const SOURCE_ROOTS = [
  "apps/api/src",
  "apps/mobile/src",
  "apps/web/src",
  "packages/worker/src",
  "packages/ui/src",
  "packages/db/src",
  "packages/reader/src",
];
const MOBILE_SRC = "apps/mobile/src";
const MOBILE_ALIASES: Record<string, string> = {
  "@/": "",
  "@modules/": "modules/",
  "@hooks/": "hooks/",
  "@lib/": "lib/",
  "@ui/": "components/ui/",
};
// Shared mobile code sits below every domain module and must not reach back up.
const MOBILE_SHARED_LAYERS = new Set(["components", "hooks", "lib", "theme"]);
// Shared article code that inbox, reader, and recents build on.
const MOBILE_ARTICLES_MODULE = "articles";
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

function resolveMobileImport(file: string, specifier: string): string | null {
  if (specifier.startsWith(".")) {
    return normalize(join(dirname(file), specifier));
  }
  for (const [alias, target] of Object.entries(MOBILE_ALIASES)) {
    if (specifier.startsWith(alias)) {
      return `${MOBILE_SRC}/${target}${specifier.slice(alias.length)}`;
    }
  }
  return null;
}

function mobileModuleOf(path: string): string | null {
  return path.match(/^apps\/mobile\/src\/modules\/([^/]+)/)?.[1] ?? null;
}

function checkMobileLayering(file: string, specifier: string): string | null {
  const target = resolveMobileImport(file, specifier);
  const targetModule = target ? mobileModuleOf(target) : null;
  if (!targetModule) {
    return null;
  }
  const layer = file.slice(MOBILE_SRC.length + 1).split("/")[0] ?? "";
  if (MOBILE_SHARED_LAYERS.has(layer)) {
    return "shared mobile code must not import domain modules";
  }
  if (mobileModuleOf(file) === MOBILE_ARTICLES_MODULE && targetModule !== MOBILE_ARTICLES_MODULE) {
    return "the mobile articles module must not import other domain modules";
  }
  return null;
}

function checkFile(root: string, file: string): Violation[] {
  const violations: Violation[] = [];
  const isPackageFile = file.startsWith("packages/");
  const isWorkerFile = file.startsWith("packages/worker/");
  const isRouteFile = file.startsWith("apps/api/src/modules/") && file.endsWith(".routes.ts");
  const isMobileFile = file.startsWith(`${MOBILE_SRC}/`);

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
    const mobileLayeringViolation = isMobileFile ? checkMobileLayering(file, specifier) : null;
    if (mobileLayeringViolation) {
      violations.push({ file, specifier, reason: mobileLayeringViolation });
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

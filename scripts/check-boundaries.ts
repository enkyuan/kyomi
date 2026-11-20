import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { checkImportCycles, resolveRelative } from "./boundaries/cycles";

export const SOURCE_ROOTS = [
  "apps/api/src",
  "apps/mobile/src",
  "apps/web/src",
  "packages/ingest/src",
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
  const isWorkerFile = file.startsWith("packages/ingest/");
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
      violations.push({ file, specifier, reason: "ingest must not import API/http modules" });
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

const WEB_SRC = "apps/web/src";
const WEB_ALIASES: Record<string, string> = {
  "@/": "",
  "@modules/": "modules/",
  "@hooks/": "hooks/",
  "@lib/": "lib/",
  "@integrations/": "integrations/",
};
// Shared web code sits below every domain module and must not reach back up.
const WEB_SHARED_LAYERS = new Set(["hooks", "integrations", "lib"]);
// The web module stack, top to bottom. A module imports its own tier or the tiers below it.
const WEB_MODULE_TIERS = [
  ["sidebar", "settings", "auth", "onboarding"],
  ["inbox"],
  ["reader"],
  ["articles"],
  ["feeds", "folders", "preferences"],
];
const WEB_MODULE_TIER = new Map(
  WEB_MODULE_TIERS.flatMap((modules, tier) => modules.map((name) => [name, tier] as const)),
);

function resolveWebImport(file: string, specifier: string): string | null {
  if (specifier.startsWith(".")) {
    return join(file, "..", specifier);
  }
  for (const [alias, target] of Object.entries(WEB_ALIASES)) {
    if (specifier.startsWith(alias)) {
      return `${WEB_SRC}/${target}${specifier.slice(alias.length)}`;
    }
  }
  return null;
}

function webModuleOf(path: string): string | null {
  return path.match(/^apps\/web\/src\/modules\/([^/]+)/)?.[1] ?? null;
}

type WebModuleEdges = Map<string, Map<string, { file: string; specifier: string }>>;

function webModuleReaches(edges: WebModuleEdges, from: string, to: string): boolean {
  const pending = [from];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current === to) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    pending.push(...(edges.get(current)?.keys() ?? []));
  }
  return false;
}

function addWebModuleEdge(
  edges: WebModuleEdges,
  fromModule: string,
  toModule: string,
  importSite: { file: string; specifier: string },
) {
  const targets = edges.get(fromModule) ?? new Map();
  if (!targets.has(toModule)) targets.set(toModule, importSite);
  edges.set(fromModule, targets);
}

// Web domain modules may depend on each other in one direction only, including type imports.
function checkWebModules(root: string, files: string[]): Violation[] {
  const violations: Violation[] = [];
  const edges: WebModuleEdges = new Map();

  for (const file of files.filter((path) => path.startsWith(`${WEB_SRC}/`))) {
    const layer = file.slice(WEB_SRC.length + 1).split("/")[0] ?? "";
    const fromModule = webModuleOf(file);
    for (const specifier of collectImports(root, file)) {
      const target = resolveWebImport(file, specifier);
      const toModule = target ? webModuleOf(target) : null;
      if (!toModule || toModule === fromModule) continue;
      if (WEB_SHARED_LAYERS.has(layer)) {
        violations.push({
          file,
          specifier,
          reason: "shared web code must not import domain modules",
        });
      } else if (fromModule) {
        addWebModuleEdge(edges, fromModule, toModule, { file, specifier });
      }
    }
  }

  for (const [fromModule, targets] of edges) {
    for (const [toModule, { file, specifier }] of targets) {
      const reason = webModuleEdgeViolation(edges, fromModule, toModule);
      if (reason) violations.push({ file, specifier, reason });
    }
  }

  return violations;
}

function webModuleEdgeViolation(
  edges: WebModuleEdges,
  fromModule: string,
  toModule: string,
): string | null {
  const fromTier = WEB_MODULE_TIER.get(fromModule);
  const toTier = WEB_MODULE_TIER.get(toModule);
  if (fromTier === undefined || toTier === undefined) {
    const unplaced = fromTier === undefined ? fromModule : toModule;
    return `web module ${unplaced} has no place in the module stack; add it to WEB_MODULE_TIERS`;
  }
  if (toTier < fromTier) {
    return `web module ${fromModule} must not import ${toModule}, which sits above it in the module stack`;
  }
  // Modules in one tier may import each other, but only in one direction. A cycle that crosses
  // tiers always contains an upward import, which the rank check above already reports.
  if (toTier === fromTier && webModuleReaches(edges, toModule, fromModule)) {
    return `web modules ${fromModule} and ${toModule} must not depend on each other in a cycle`;
  }
  return null;
}

const API_SRC = "apps/api/src";
const API_ALIASES: Record<string, string> = {
  "@/": "",
  "@app/": "app/",
  "@config/": "config/",
  "@adapters/": "adapters/",
  "@shared/": "shared/",
  "@modules/": "modules/",
};
// The API layer stack, top to bottom. A layer imports its own tier or the tiers below it. `config`
// and `shared` share the bottom tier: configuration fails with the shared error catalogue, and the
// shared HTTP stacks read configuration.
const API_LAYER_TIERS = [["app"], ["modules"], ["adapters"], ["shared", "config"]];
const API_LAYER_TIER = new Map(
  API_LAYER_TIERS.flatMap((layers, tier) => layers.map((name) => [name, tier] as const)),
);

function resolveApiImport(file: string, specifier: string): string | null {
  if (specifier.startsWith(".")) {
    return resolveRelative(file, specifier);
  }
  for (const [alias, target] of Object.entries(API_ALIASES)) {
    if (specifier.startsWith(alias)) {
      return `${API_SRC}/${target}${specifier.slice(alias.length)}`;
    }
  }
  return null;
}

/** `src/<layer>/...`; null for a file directly in `src` (the entrypoint). */
function apiLayerOf(path: string): string | null {
  return path.match(/^apps\/api\/src\/([^/]+)\//)?.[1] ?? null;
}

function apiModuleOf(path: string): string | null {
  return path.match(/^apps\/api\/src\/modules\/([^/]+)/)?.[1] ?? null;
}

function apiLayerViolation(fromLayer: string, toLayer: string): string | null {
  const fromTier = API_LAYER_TIER.get(fromLayer);
  const toTier = API_LAYER_TIER.get(toLayer);
  if (fromTier === undefined || toTier === undefined) {
    const unplaced = fromTier === undefined ? fromLayer : toLayer;
    return `api layer ${unplaced} has no place in the layer stack; add it to API_LAYER_TIERS`;
  }
  if (toTier < fromTier) {
    return `api ${fromLayer} must not import ${toLayer}, which sits above it in the layer stack`;
  }
  return null;
}

// API code depends downward only (app, then modules, then adapters, then shared and config), and
// domain modules form a graph without cycles. Type imports count: they still tie files together.
function checkApiStructure(root: string, files: string[]): Violation[] {
  const violations: Violation[] = [];
  const edges: WebModuleEdges = new Map();

  for (const file of files.filter((path) => path.startsWith(`${API_SRC}/`))) {
    const fromLayer = apiLayerOf(file);
    const fromModule = apiModuleOf(file);
    for (const specifier of collectImports(root, file)) {
      const target = resolveApiImport(file, specifier);
      const toLayer = target ? apiLayerOf(target) : null;
      if (!target || !toLayer) continue;
      if (fromLayer && fromLayer !== toLayer) {
        const reason = apiLayerViolation(fromLayer, toLayer);
        if (reason) violations.push({ file, specifier, reason });
      }
      const toModule = apiModuleOf(target);
      if (fromModule && toModule && fromModule !== toModule) {
        addWebModuleEdge(edges, fromModule, toModule, { file, specifier });
      }
    }
  }

  for (const [fromModule, targets] of edges) {
    for (const [toModule, { file, specifier }] of targets) {
      if (webModuleReaches(edges, toModule, fromModule)) {
        violations.push({
          file,
          specifier,
          reason: `api modules ${fromModule} and ${toModule} must not depend on each other in a cycle`,
        });
      }
    }
  }

  return violations;
}

/** An import specifier as a path without an extension, for the source roots that have aliases. */
function resolveSourceImport(file: string, specifier: string): string | null {
  if (file.startsWith(`${API_SRC}/`)) return resolveApiImport(file, specifier);
  if (file.startsWith(`${WEB_SRC}/`)) return resolveWebImport(file, specifier);
  if (file.startsWith(`${MOBILE_SRC}/`)) return resolveMobileImport(file, specifier);
  return resolveRelative(file, specifier);
}

export function checkBoundaries(root = process.cwd()): Violation[] {
  const files = sourceFiles(root);
  return [
    ...files.flatMap((file) => checkFile(root, file)),
    ...checkWebModules(root, files),
    ...checkApiStructure(root, files),
    ...checkImportCycles(root, files, resolveSourceImport),
  ];
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

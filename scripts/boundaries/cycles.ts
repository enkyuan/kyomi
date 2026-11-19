import { readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

export type CycleViolation = { file: string; specifier: string; reason: string };

/** Maps an import specifier written in `file` to a path without an extension, or null for a package. */
export type ResolveImport = (file: string, specifier: string) => string | null;

/**
 * Static `import` / `export ... from` statements. A dynamic `import()` is not matched: it loads
 * lazily, so it is how a cycle is broken, not how one forms.
 */
const STATEMENT_RE =
  /(?:^|\n)[ \t]*(?:import|export)\s+(type\s+)?([^;'"]*?)\s*from\s+["']([^"']+)["']/g;
const INLINE_TYPE_ONLY_RE = /^\{\s*(?:type\s+[\w$]+(?:\s+as\s+[\w$]+)?\s*,?\s*)+\}$/;
/** Generated files (the router's route tree) import the app they describe by design. */
const GENERATED_RE = /\.gen\.tsx?$/;

function isTypeOnly(typeKeyword: string | undefined, clause: string): boolean {
  return Boolean(typeKeyword) || INLINE_TYPE_ONLY_RE.test(clause.trim());
}

/** The file `base` names, trying the extensions and index files TypeScript resolves. */
function resolveFile(base: string, known: ReadonlySet<string>): string | null {
  const stem = base.replace(/\.(?:js|jsx)$/, "");
  for (const candidate of [
    base,
    `${stem}.ts`,
    `${stem}.tsx`,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ]) {
    if (known.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

/** `file` to the files it imports at runtime (type-only imports are erased and cannot loop). */
function runtimeImportGraph(
  root: string,
  files: readonly string[],
  resolveImport: ResolveImport,
): Map<string, Array<{ target: string; specifier: string }>> {
  const known = new Set(files);
  const graph = new Map<string, Array<{ target: string; specifier: string }>>();
  for (const file of files) {
    const edges: Array<{ target: string; specifier: string }> = [];
    for (const match of readFileSync(join(root, file), "utf8").matchAll(STATEMENT_RE)) {
      const [, typeKeyword, clause = "", specifier = ""] = match;
      if (isTypeOnly(typeKeyword, clause)) {
        continue;
      }
      const base = resolveImport(file, specifier);
      const target = base === null ? null : resolveFile(normalize(base), known);
      if (target !== null && target !== file) {
        edges.push({ target, specifier });
      }
    }
    graph.set(file, edges);
  }
  return graph;
}

/** Groups of two or more files that import each other, directly or through others (Tarjan). */
function cycleGroups(graph: ReadonlyMap<string, ReadonlyArray<{ target: string }>>): string[][] {
  const groups: string[][] = [];
  const order = new Map<string, number>();
  const lowest = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  const visit = (file: string) => {
    order.set(file, order.size);
    lowest.set(file, order.get(file)!);
    stack.push(file);
    onStack.add(file);
    for (const { target } of graph.get(file) ?? []) {
      if (!order.has(target)) {
        visit(target);
        lowest.set(file, Math.min(lowest.get(file)!, lowest.get(target)!));
      } else if (onStack.has(target)) {
        lowest.set(file, Math.min(lowest.get(file)!, order.get(target)!));
      }
    }
    if (lowest.get(file) === order.get(file)) {
      const group: string[] = [];
      let member: string;
      do {
        member = stack.pop()!;
        onStack.delete(member);
        group.push(member);
      } while (member !== file);
      if (group.length > 1) {
        groups.push(group.sort());
      }
    }
  };

  for (const file of graph.keys()) {
    if (!order.has(file)) {
      visit(file);
    }
  }
  return groups;
}

const SHOWN_MEMBERS = 4;

/**
 * Files that import each other at runtime. A cycle makes the load order matter (a binding can be
 * read before it is initialised) and ties files together that were meant to be separate. One
 * violation is reported per cycle, at the first import that closes it; type-only imports, dynamic
 * `import()` and generated files are not counted.
 */
export function checkImportCycles(
  root: string,
  files: readonly string[],
  resolveImport: ResolveImport,
): CycleViolation[] {
  const graph = runtimeImportGraph(
    root,
    files.filter((file) => !GENERATED_RE.test(file)),
    resolveImport,
  );
  return cycleGroups(graph).map((group) => {
    const members = new Set(group);
    const first = group[0]!;
    const edge = graph.get(first)!.find(({ target }) => members.has(target))!;
    const shown = group.slice(0, SHOWN_MEMBERS).map((file) => file.split("/").slice(-2).join("/"));
    const more = group.length > SHOWN_MEMBERS ? `, and ${group.length - SHOWN_MEMBERS} more` : "";
    return {
      file: first,
      specifier: edge.specifier,
      reason: `import cycle between ${group.length} files (${shown.join(", ")}${more})`,
    };
  });
}

/** `./x` and `../x` against the importing file; anything else is not a file in this tree. */
export function resolveRelative(file: string, specifier: string): string | null {
  return specifier.startsWith(".") ? join(dirname(file), specifier) : null;
}

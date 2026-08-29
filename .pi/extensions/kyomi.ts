import { relative, resolve, sep } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const GENERATED_ROUTE_TREE = "apps/web/src/routeTree.gen.ts";
const GENERATED_DIRECTORIES = new Set([
  ".expo",
  ".git",
  ".gradle",
  ".nitro",
  ".output",
  ".tanstack",
  ".turbo",
  ".venv",
  "__pycache__",
  "android/build",
  "build",
  "coverage",
  "dist",
  "ios/build",
  "ios/Pods",
  "node_modules",
]);

function projectPath(ctx: ExtensionContext, input: unknown): string | undefined {
  if (typeof input !== "string" || input.trim() === "") return;

  const path = input.trim().replace(/^@/, "");
  return relative(ctx.cwd, resolve(ctx.cwd, path)).split(sep).join("/");
}

function protectionReason(path: string): string | undefined {
  if (path === "" || path === ".." || path.startsWith("../")) {
    return "the target is outside the project workspace";
  }

  const segments = path.split("/");
  const basename = segments.at(-1) ?? "";
  const isEnvironmentFile = basename === ".env" || /^\.env\.[^/]+$/.test(basename);
  const isExample = /\.env\.(example|sample|template|defaults)$/.test(basename);

  if (isEnvironmentFile && !isExample) {
    return "environment files may contain secrets; use the approved dotenv workflow";
  }

  if (path === GENERATED_ROUTE_TREE) {
    return "routeTree.gen.ts is generated; update routes and run the route generator";
  }

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments.slice(index, index + 2).join("/");
    if (GENERATED_DIRECTORIES.has(segment) || GENERATED_DIRECTORIES.has(segments[index] ?? "")) {
      return `the target is generated or tool-owned output (${segment})`;
    }
  }

  return undefined;
}

function notifyBlocked(ctx: ExtensionContext, path: string, reason: string): void {
  if (ctx.hasUI) ctx.ui.notify(`Blocked direct write to ${path}: ${reason}`, "warning");
}

export default function kyomiQualityExtension(pi: ExtensionAPI): void {
  pi.on("before_agent_start", async () => ({
    message: {
      customType: "kyomi-quality-guidance",
      content: `[KYOMI IMPLEMENTATION FRAMEWORK]
Before substantial work:
- Identify the owning app/package/domain, trust boundaries, existing seam, and affected checks.
- Load the smallest applicable skill from .agents/skills/ and inspect the manifest, nearby code, callers, exports, and closest tests.
- For framework or native-platform APIs, inspect the resolved installed declarations and fetch matching first-party docs. Prefer versioned Markdown or llms.txt indexes.
- Reuse an existing owner, seam, export, and dependency before creating a file, directory, package, abstraction, or dependency.
- Preserve kebab-case authored names and framework-mandated names. Keep routes and composition thin.
After framework-sensitive work, report installed-version/type evidence, 2-4 official URLs, the applied contract, any Kyomi divergence, and focused verification results. Finish through $qa.
[/KYOMI IMPLEMENTATION FRAMEWORK]`,
      display: false,
    },
  }));

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "edit" && event.toolName !== "write") return;

    const path = projectPath(ctx, event.input.path);
    if (path === undefined) {
      return { block: true, reason: "direct file mutations require a project-relative path" };
    }

    const reason = protectionReason(path);
    if (reason === undefined) return;

    notifyBlocked(ctx, path, reason);
    return { block: true, reason: `Kyomi guard: ${reason}` };
  });
}

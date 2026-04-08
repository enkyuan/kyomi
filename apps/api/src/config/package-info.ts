import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "package.json");

function readVersion(): string {
  try {
    const raw = readFileSync(packageJsonPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const version = Reflect.get(parsed, "version");
      if (typeof version === "string" && version.length > 0) {
        return version;
      }
    }
  } catch {
    // ignore
  }
  return "0.0.0";
}

/** `apps/api/package.json` version, read once at module load. */
export const API_PACKAGE_VERSION = readVersion();

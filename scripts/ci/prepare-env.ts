import { copyFileSync, existsSync, readFileSync, appendFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fail, section } from "./log";

const ROOT_DIR = join(import.meta.dir, "../..");
const isForced = process.env.CI === "true" || process.env.KYOMI_FORCE_PREPARE_ENV === "1";

function rel(path: string) {
  return relative(ROOT_DIR, path);
}

function copyEnv(examplePath: string, targetPath: string) {
  if (!existsSync(examplePath)) {
    fail(`Missing checked-in env example: ${examplePath}`);
  }

  if (isForced) {
    copyFileSync(examplePath, targetPath);
    console.log(`Reset ${rel(targetPath)} from ${rel(examplePath)}`);
    return;
  }

  if (existsSync(targetPath)) {
    console.log(`Using existing ${rel(targetPath)}`);
    return;
  }

  copyFileSync(examplePath, targetPath);
  console.log(`Created ${rel(targetPath)} from ${rel(examplePath)}`);
}

function ensureEnvValue(targetPath: string, key: string, value: string, existedBefore: boolean) {
  const hasKey = (contents: string) => new RegExp(`^${key}=`, "m").test(contents);

  if (!isForced && existedBefore) {
    if (!hasKey(readFileSync(targetPath, "utf8"))) {
      console.log(
        `Missing ${key} in existing ${rel(targetPath)}; leaving local env untouched. Set KYOMI_FORCE_PREPARE_ENV=1 to write defaults.`,
      );
    }
    return;
  }

  if (hasKey(readFileSync(targetPath, "utf8"))) {
    return;
  }

  appendFileSync(targetPath, `${key}=${value}\n`);
  console.log(`Set ${key} in ${rel(targetPath)}`);
}

const apiEnvPath = join(ROOT_DIR, "apps/api/.env");
const webEnvPath = join(ROOT_DIR, "apps/web/.env");
const apiEnvExisted = existsSync(apiEnvPath);
const webEnvExisted = existsSync(webEnvPath);

section("Preparing CI env files");
copyEnv(join(ROOT_DIR, "docker/.env.example"), join(ROOT_DIR, "docker/.env"));
copyEnv(join(ROOT_DIR, "apps/api/.env.example"), apiEnvPath);
copyEnv(join(ROOT_DIR, "apps/web/.env.example"), webEnvPath);

section("Ensuring required app defaults");
ensureEnvValue(apiEnvPath, "BETTER_AUTH_URL", "http://localhost:3000", apiEnvExisted);
ensureEnvValue(apiEnvPath, "BETTER_AUTH_TRUSTED_ORIGINS", "http://localhost:3000", apiEnvExisted);
ensureEnvValue(apiEnvPath, "MEILI_URL", "http://localhost:7700", apiEnvExisted);
ensureEnvValue(apiEnvPath, "MEILI_MASTER_KEY", "vols-meili-dev-key", apiEnvExisted);
ensureEnvValue(apiEnvPath, "MEILI_INDEX_FEEDS", "feeds", apiEnvExisted);
ensureEnvValue(apiEnvPath, "SKIP_ENV_VALIDATION", "true", apiEnvExisted);
ensureEnvValue(webEnvPath, "SERVER_URL", "http://localhost:3000", webEnvExisted);
ensureEnvValue(webEnvPath, "API_ORIGIN", "http://localhost:8000", webEnvExisted);

section("Environment ready");

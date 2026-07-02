import { $ } from "bun";
import { join } from "node:path";
import { fail, section } from "./log";

const ROOT_DIR = join(import.meta.dir, "../..");
const DRIZZLE_PATH = "packages/db/drizzle";

async function hasDiff(args: string[]) {
  const result = await $`git -C ${ROOT_DIR} diff ${args} -- ${DRIZZLE_PATH}`.quiet().nothrow();
  return result.stdout.length > 0;
}

section("Checking Drizzle migration drift");

if (await hasDiff([])) {
  fail(
    "Drizzle migration files already have unstaged changes. Commit or stash them before running the drift check.",
  );
}

if (await hasDiff(["--cached"])) {
  fail(
    "Drizzle migration files already have staged changes. Commit or unstage them before running the drift check.",
  );
}

section("Regenerating migrations");
await $`bun run --cwd packages/db db:generate`.cwd(ROOT_DIR);

section("Inspecting generated diff");
if (!(await hasDiff([]))) {
  console.log("Drizzle migrations are up to date.");
  process.exit(0);
}

await $`git -C ${ROOT_DIR} --no-pager diff -- ${DRIZZLE_PATH}`;
fail(
  "Drizzle generated migration changes. Run 'bun run db:generate' locally and commit the resulting migration files.",
);

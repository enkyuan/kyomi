/// <reference types="bun" />

const [command, ...args] = process.argv.slice(2);

if (!command) {
  throw new Error("Usage: bun scripts/with-env.ts <command> [...args]");
}

// `.env.local` is the documented local override. Keep `.env` as a private,
// ignored migration fallback so existing developer setups do not stop working.
const localEnvFile = (await Bun.file(".env.local").exists()) ? ".env.local" : ".env";
const child = Bun.spawn(
  [
    "bunx",
    "--no-install",
    "dotenvx",
    "run",
    "-f",
    "../../docker/.env",
    "-f",
    localEnvFile,
    "--",
    command,
    ...args,
  ],
  { stderr: "inherit", stdin: "inherit", stdout: "inherit" },
);

process.exit(await child.exited);

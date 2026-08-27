/// <reference types="bun" />

const [command, ...args] = process.argv.slice(2);

if (!command) {
  throw new Error("Usage: bun scripts/with-env.ts <command> [...args]");
}

// `.env.local` is the documented local override. Keep `.env` as a private,
// ignored migration fallback so existing developer setups do not stop working.
// Neither file is required: the app has local development defaults for public
// configuration when no override is needed.
const localEnvFile = (await Bun.file(".env.local").exists())
  ? ".env.local"
  : (await Bun.file(".env").exists())
    ? ".env"
    : null;
const localEnvArgs = localEnvFile ? ["-f", localEnvFile] : [];

const env = { ...process.env };

if (process.platform === "darwin" && !env.DEVELOPER_DIR) {
  const candidateDirs = [
    "/Applications/Xcode.app/Contents/Developer",
    "/Applications/Xcode-beta.app/Contents/Developer",
  ];
  for (const dir of candidateDirs) {
    if (await Bun.file(`${dir}/usr/bin/xcodebuild`).exists()) {
      env.DEVELOPER_DIR = dir;
      break;
    }
  }
}

const child = Bun.spawn(
  [
    "bunx",
    "--no-install",
    "dotenvx",
    "run",
    "-f",
    "../../docker/.env",
    ...localEnvArgs,
    "--",
    command,
    ...args,
  ],
  { env, stderr: "inherit", stdin: "inherit", stdout: "inherit" },
);

process.exit(await child.exited);

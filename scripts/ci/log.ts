export function section(title: string) {
  console.log(`\n==> ${title}`);
}

export function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

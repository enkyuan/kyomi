// @dotenvx/primitives ships no declarations; this is the part of it scripts/ci uses.
declare module "@dotenvx/primitives" {
  export function scan(src: string): { parsed: Record<string, string[]> };
  export function encrypted(value: string): boolean;
}

const maxEntries = 4096;
const ttlMs = 15_000;
const bitCount = 65_536;
const hashSeeds = [0, 1, 2] as const;

/** A Bloom filter for the bounded cache of recent, database-confirmed claims. */
export class TakenUsernames {
  readonly #bits = new Uint8Array(bitCount / 8);
  readonly #expiresAt = new Map<string, number>();

  has(username: string, now: number) {
    for (const seed of hashSeeds) {
      const bit = Bun.hash.murmur32v3(username, seed) % bitCount;
      if (!(this.#bits[bit >>> 3]! & (1 << (bit & 7)))) return false;
    }
    // A Bloom hit never makes a decision on its own.
    return (this.#expiresAt.get(username) ?? 0) > now;
  }

  add(username: string, now: number) {
    if (this.#expiresAt.size >= maxEntries && !this.#expiresAt.has(username)) {
      this.#expiresAt.clear();
      this.#bits.fill(0);
    }
    for (const seed of hashSeeds) {
      const bit = Bun.hash.murmur32v3(username, seed) % bitCount;
      this.#bits[bit >>> 3] = this.#bits[bit >>> 3]! | (1 << (bit & 7));
    }
    this.#expiresAt.set(username, now + ttlMs);
  }
}

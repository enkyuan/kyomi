const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  copy: "©",
  reg: "®",
  trade: "™",
};

function decodeCodePoint(value: number, fallback: string): string {
  try {
    return String.fromCodePoint(value);
  } catch {
    return fallback;
  }
}

export function decodeHtmlEntities(value: string): string {
  let decoded = value;

  for (let pass = 0; pass < 2; pass += 1) {
    const next = decoded.replace(
      /&(?:#(\d+)|#x([\da-fA-F]+)|([a-zA-Z][\w]+));/g,
      (_match, decimal, hexadecimal, named) => {
        if (decimal) {
          const codePoint = Number.parseInt(decimal, 10);
          return Number.isFinite(codePoint) ? decodeCodePoint(codePoint, _match) : _match;
        }

        if (hexadecimal) {
          const codePoint = Number.parseInt(hexadecimal, 16);
          return Number.isFinite(codePoint) ? decodeCodePoint(codePoint, _match) : _match;
        }

        if (named) {
          return NAMED_HTML_ENTITIES[named] ?? _match;
        }

        return _match;
      },
    );

    if (next === decoded) {
      break;
    }
    decoded = next;
  }

  return decoded;
}

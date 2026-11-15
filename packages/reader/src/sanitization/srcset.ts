/**
 * Splits a `srcset` the way the HTML parser does: a URL is a run of non-whitespace (it may contain
 * commas, as CDN transform URLs do), and its descriptors run to the next comma.
 */
export function parseSrcset(value: string): { url: string; descriptor: string }[] {
  const candidates: { url: string; descriptor: string }[] = [];
  let i = 0;
  while (i < value.length) {
    while (i < value.length && (/\s/.test(value[i]!) || value[i] === ",")) {
      i += 1;
    }
    if (i >= value.length) {
      break;
    }
    const urlStart = i;
    while (i < value.length && !/\s/.test(value[i]!)) {
      i += 1;
    }
    let url = value.slice(urlStart, i);
    let descriptor = "";
    if (url.endsWith(",")) {
      url = url.replace(/,+$/, "");
    } else {
      const descriptorStart = i;
      while (i < value.length && value[i] !== ",") {
        i += 1;
      }
      descriptor = value.slice(descriptorStart, i).trim();
    }
    candidates.push({ url, descriptor });
  }
  return candidates;
}

export function serializeSrcset(candidates: { url: string; descriptor: string }[]): string {
  return candidates
    .map(({ url, descriptor }) => (descriptor ? `${url} ${descriptor}` : url))
    .join(", ");
}

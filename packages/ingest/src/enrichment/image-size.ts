export type ImageDimensions = { width: number; height: number };

/** Bytes worth buffering before giving up on header-only dimension parsing. */
export const IMAGE_HEADER_PROBE_BYTES = 256 * 1024;

const MAX_DIMENSION = 65_535;

function valid(width: number, height: number): ImageDimensions | null {
  const w = Math.round(width);
  const h = Math.round(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return null;
  if (w > MAX_DIMENSION || h > MAX_DIMENSION) return null;
  return { width: w, height: h };
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = "";
  for (let i = start; i < start + length && i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i] ?? 0);
  }
  return out;
}

function parsePng(view: DataView): ImageDimensions | null {
  if (view.byteLength < 24) return null;
  return valid(view.getUint32(16), view.getUint32(20));
}

function parseGif(view: DataView): ImageDimensions | null {
  if (view.byteLength < 10) return null;
  return valid(view.getUint16(6, true), view.getUint16(8, true));
}

function parseJpeg(bytes: Uint8Array, view: DataView): ImageDimensions | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    // Standalone markers carry no length.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = view.getUint16(offset + 2);
    const isFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      return valid(view.getUint16(offset + 7), view.getUint16(offset + 5));
    }
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function parseWebp(bytes: Uint8Array, view: DataView): ImageDimensions | null {
  if (bytes.length < 25) return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X") {
    if (bytes.length < 30) return null;
    const width = 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
    const height = 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
    return valid(width, height);
  }
  if (chunk === "VP8L") {
    if (bytes[20] !== 0x2f) return null;
    const bits = view.getUint32(21, true);
    return valid((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
  }
  if (chunk === "VP8 ") {
    if (bytes.length < 30) return null;
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return valid(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff);
  }
  return null;
}

/** AVIF/HEIF store the primary size in an `ispe` property box inside `meta`. */
function parseIsobmff(bytes: Uint8Array, view: DataView): ImageDimensions | null {
  const brand = ascii(bytes, 8, 4);
  if (brand !== "avif" && brand !== "avis" && brand !== "mif1" && brand !== "heic") return null;
  for (let i = 12; i + 16 <= bytes.length; i += 1) {
    if (
      bytes[i] === 0x69 &&
      bytes[i + 1] === 0x73 &&
      bytes[i + 2] === 0x70 &&
      bytes[i + 3] === 0x65
    ) {
      // type(4) version/flags(4) width(4) height(4)
      return valid(view.getUint32(i + 8), view.getUint32(i + 12));
    }
  }
  return null;
}

function parseSvg(bytes: Uint8Array): ImageDimensions | null {
  const text = new TextDecoder().decode(bytes);
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0];
  if (!tag) return null;
  const attr = (name: string) =>
    new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag)?.[1];
  const px = (value: string | undefined) => {
    const match = value ? /^\s*([\d.]+)\s*(px)?\s*$/i.exec(value) : null;
    return match ? Number(match[1]) : null;
  };
  const width = px(attr("width"));
  const height = px(attr("height"));
  if (width && height) return valid(width, height);
  const box = attr("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (box?.length === 4 && box.every(Number.isFinite)) return valid(box[2]!, box[3]!);
  return null;
}

/**
 * Reads pixel dimensions from the leading bytes of an image. Returns null when the format is
 * unknown or the buffer is too short; callers may retry with more bytes up to
 * `IMAGE_HEADER_PROBE_BYTES`.
 */
export function readImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 10) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return parsePng(view);
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return parseJpeg(bytes, view);
  const head = ascii(bytes, 0, 4);
  if (head === "GIF8") return parseGif(view);
  if (head === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return parseWebp(bytes, view);
  if (ascii(bytes, 4, 4) === "ftyp") return parseIsobmff(bytes, view);
  return parseSvg(bytes.subarray(0, 4096));
}

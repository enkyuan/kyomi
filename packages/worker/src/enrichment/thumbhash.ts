import sharp from "sharp";
import { rgbaToThumbHash } from "thumbhash";

const THUMBHASH_MAX_EDGE = 100;
const THUMBHASH_MAX_INPUT_PIXELS = 64_000_000;

/**
 * Base64 thumbhash for a fully downloaded raster image, or null when it cannot be decoded.
 * Decoding is bounded by `limitInputPixels` so a small file cannot expand into a huge bitmap.
 */
export async function computeThumbhash(bytes: Uint8Array): Promise<string | null> {
  try {
    const { data, info } = await sharp(bytes, {
      limitInputPixels: THUMBHASH_MAX_INPUT_PIXELS,
      failOn: "error",
    })
      .resize(THUMBHASH_MAX_EDGE, THUMBHASH_MAX_EDGE, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const hash = rgbaToThumbHash(info.width, info.height, data);
    return Buffer.from(hash).toString("base64");
  } catch {
    return null;
  }
}

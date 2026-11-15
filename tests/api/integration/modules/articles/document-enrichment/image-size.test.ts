import { describe, expect, test } from "bun:test";
import { crc32, deflateSync } from "node:zlib";
import { computeThumbhash, readImageDimensions } from "@kyomi/worker/enrichment";

function bytes(...parts: (number[] | string)[]): Uint8Array {
  return Uint8Array.from(
    parts.flatMap((part) =>
      typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : part,
    ),
  );
}
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const be16 = (n: number) => [(n >>> 8) & 255, n & 255];
const le16 = (n: number) => [n & 255, (n >>> 8) & 255];
const le24 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255];

describe("readImageDimensions", () => {
  test("png", () => {
    const png = bytes(
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      be32(13),
      "IHDR",
      be32(640),
      be32(480),
    );
    expect(readImageDimensions(png)).toEqual({ width: 640, height: 480 });
  });

  test("gif", () => {
    expect(readImageDimensions(bytes("GIF89a", le16(300), le16(200), [0, 0]))).toEqual({
      width: 300,
      height: 200,
    });
  });

  test("jpeg finds SOF after an APP1 segment", () => {
    const app1 = [0xff, 0xe1, ...be16(8), 0, 0, 0, 0, 0, 0];
    const sof = [0xff, 0xc2, ...be16(11), 8, ...be16(768), ...be16(1024), 3, 1, 0x22, 0];
    expect(readImageDimensions(bytes([0xff, 0xd8], app1, sof))).toEqual({
      width: 1024,
      height: 768,
    });
  });

  test("jpeg without a frame header in the probed bytes is unknown", () => {
    expect(
      readImageDimensions(bytes([0xff, 0xd8, 0xff, 0xe1, ...be16(60000), 0, 0, 0, 0, 0, 0])),
    ).toBeNull();
  });

  test("webp lossy, lossless, and extended", () => {
    const riff = (chunk: string, body: number[]) =>
      bytes("RIFF", [0, 0, 0, 0], "WEBP", chunk, [0, 0, 0, 0], body);
    expect(
      readImageDimensions(
        riff("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(320), ...le16(240), 0, 0]),
      ),
    ).toEqual({ width: 320, height: 240 });
    const bits = (500 - 1) | ((300 - 1) << 14);
    expect(
      readImageDimensions(
        riff("VP8L", [
          0x2f,
          bits & 255,
          (bits >> 8) & 255,
          (bits >> 16) & 255,
          (bits >>> 24) & 255,
          0,
        ]),
      ),
    ).toEqual({ width: 500, height: 300 });
    expect(
      readImageDimensions(riff("VP8X", [0, 0, 0, 0, ...le24(999), ...le24(599), 0, 0])),
    ).toEqual({ width: 1000, height: 600 });
  });

  test("avif reads the ispe box", () => {
    const avif = bytes(
      be32(24),
      "ftypavif",
      [0, 0, 0, 0],
      "avifmif1",
      be32(20),
      "ispe",
      [0, 0, 0, 0],
      be32(2048),
      be32(1365),
    );
    expect(readImageDimensions(avif)).toEqual({ width: 2048, height: 1365 });
  });

  test("svg uses width/height, falling back to viewBox", () => {
    expect(readImageDimensions(bytes('<svg xmlns="x" width="120px" height="80"></svg>'))).toEqual({
      width: 120,
      height: 80,
    });
    expect(readImageDimensions(bytes('<svg viewBox="0 0 24 16" width="100%"></svg>'))).toEqual({
      width: 24,
      height: 16,
    });
  });

  test("rejects unknown, truncated, and zero-sized data", () => {
    expect(readImageDimensions(bytes("not an image at all"))).toBeNull();
    expect(readImageDimensions(bytes([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    const zero = bytes(
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      be32(13),
      "IHDR",
      be32(0),
      be32(0),
    );
    expect(readImageDimensions(zero)).toBeNull();
  });
});

function solidPng(width: number, height: number, rgb: [number, number, number]): Uint8Array {
  const chunk = (type: string, data: Uint8Array) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    return Buffer.concat([Buffer.from(be32(data.length)), body, Buffer.from(be32(crc32(body)))]);
  };
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(width).fill(rgb).flat())]);
  const header = Buffer.from([...be32(width), ...be32(height), 8, 2, 0, 0, 0]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(Array(height).fill(row)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("computeThumbhash", () => {
  test("encodes a decodable image deterministically", async () => {
    const png = solidPng(40, 30, [200, 40, 40]);
    expect(readImageDimensions(png)).toEqual({ width: 40, height: 30 });
    const first = await computeThumbhash(png);
    expect(first).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(first!.length).toBeLessThanOrEqual(64);
    expect(await computeThumbhash(png)).toBe(first);
  });

  test("returns null for undecodable bytes", async () => {
    expect(await computeThumbhash(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

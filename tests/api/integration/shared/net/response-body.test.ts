import { describe, expect, test } from "bun:test";
import {
  cancelResponseBody,
  readResponseBodyWithByteLimit,
  readResponseBytesWithByteLimit,
} from "@kyomi/worker/lib/response-body";

function streamResponse(chunks: Uint8Array[], headers?: Record<string, string>): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Response(stream, { headers });
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("readResponseBodyWithByteLimit", () => {
  test("succeeds at exactly the cap", async () => {
    const body = utf8("a".repeat(10));
    const response = streamResponse([body]);
    const result = await readResponseBodyWithByteLimit(response, { maxBytes: 10 });
    expect(result).toEqual({ ok: true, body: "a".repeat(10), bytesRead: 10 });
  });

  test("rejects via Content-Length before reading when it exceeds the cap", async () => {
    let pulled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled = true;
        controller.enqueue(utf8("x"));
        controller.close();
      },
    });
    const response = new Response(stream, { headers: { "content-length": "1000" } });
    const result = await readResponseBodyWithByteLimit(response, { maxBytes: 10 });
    expect(result).toEqual({
      ok: false,
      reason: "content_length",
      bytesRead: 0,
      contentLength: 1000,
    });
    expect(pulled).toBe(false);
  });

  test("falls back to streamed enforcement when Content-Length is missing or invalid", async () => {
    const response = streamResponse([utf8("hello")], { "content-length": "not-a-number" });
    const result = await readResponseBodyWithByteLimit(response, { maxBytes: 100 });
    expect(result).toEqual({ ok: true, body: "hello", bytesRead: 5 });
  });

  test("cancels immediately when the stream crosses the cap and never retains the overflow chunk", async () => {
    const response = streamResponse([utf8("aaaa"), utf8("bbbbbbbbbb")]);
    const result = await readResponseBodyWithByteLimit(response, { maxBytes: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("stream_limit");
      expect(result.bytesRead).toBe(4);
    }
  });

  test("decodes a multi-byte UTF-8 sequence split across chunks", async () => {
    const encoded = utf8("😀");
    const first = encoded.slice(0, 2);
    const second = encoded.slice(2);
    const response = streamResponse([first, second]);
    const result = await readResponseBodyWithByteLimit(response, { maxBytes: 100 });
    expect(result).toEqual({ ok: true, body: "😀", bytesRead: encoded.byteLength });
  });

  test("propagates reader errors after cancellation", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("boom"));
      },
    });
    const response = new Response(stream);
    await expect(readResponseBodyWithByteLimit(response, { maxBytes: 100 })).rejects.toThrow(
      "boom",
    );
  });
});

describe("readResponseBytesWithByteLimit", () => {
  test("preserves binary image bytes while enforcing the same limit", async () => {
    const bytes = new Uint8Array([0, 255, 137, 80, 78, 71]);
    const response = streamResponse([bytes], { "content-type": "image/png" });

    await expect(
      readResponseBytesWithByteLimit(response, { maxBytes: bytes.byteLength }),
    ).resolves.toEqual({
      ok: true,
      bytes,
      bytesRead: bytes.byteLength,
    });
  });
});

describe("cancelResponseBody", () => {
  test("cancels a response with a body without throwing", async () => {
    const response = streamResponse([utf8("x")]);
    await expect(cancelResponseBody(response)).resolves.toBeUndefined();
  });

  test("is a no-op for a response with no body", async () => {
    const response = new Response(null);
    await expect(cancelResponseBody(response)).resolves.toBeUndefined();
  });
});

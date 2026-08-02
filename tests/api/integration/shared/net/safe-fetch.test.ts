import { describe, expect, test } from "bun:test";
import { readResponseBodyWithByteLimit } from "@shared/net/safe-fetch";

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("readResponseBodyWithByteLimit (API safe-fetch)", () => {
  test("rejects via Content-Length without pulling the stream", async () => {
    let pulled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled = true;
        controller.enqueue(utf8("x"));
        controller.close();
      },
    });
    const response = new Response(stream, { headers: { "content-length": "999999999" } });

    const result = await readResponseBodyWithByteLimit(response, 10);
    expect(result).toEqual({ ok: false });
    expect(pulled).toBe(false);
  });

  test("cancels a streamed response that crosses the cap without buffering it fully", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(1024).fill(97));
        controller.enqueue(new Uint8Array(1024).fill(98));
      },
      cancel() {
        cancelled = true;
      },
    });
    const response = new Response(stream);

    const result = await readResponseBodyWithByteLimit(response, 100);
    expect(result).toEqual({ ok: false });
    expect(cancelled).toBe(true);
  });

  test("returns the decoded body under the cap", async () => {
    const response = new Response("hello world");
    const result = await readResponseBodyWithByteLimit(response, 100);
    expect(result).toEqual({ ok: true, body: "hello world" });
  });
});

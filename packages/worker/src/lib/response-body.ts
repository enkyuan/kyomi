export type ReadResponseBytesResult =
  | { ok: true; bytes: Uint8Array; bytesRead: number }
  | {
      ok: false;
      reason: "content_length" | "stream_limit";
      bytesRead: number;
      contentLength: number | null;
    };

export type ReadResponseBodyResult =
  | { ok: true; body: string; bytesRead: number }
  | {
      ok: false;
      reason: "content_length" | "stream_limit";
      bytesRead: number;
      contentLength: number | null;
    };

function parseContentLength(response: Response): number | null {
  const raw = response.headers.get("content-length");
  if (!raw || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

export async function cancelResponseBody(response: Response): Promise<void> {
  if (!response.body) return;
  await response.body.cancel().catch(() => undefined);
}

/** Read a response into bytes while enforcing its limit before and during streaming. */
export async function readResponseBytesWithByteLimit(
  response: Response,
  options: { maxBytes: number },
): Promise<ReadResponseBytesResult> {
  const { maxBytes } = options;
  const contentLength = parseContentLength(response);
  if (contentLength !== null && contentLength > maxBytes) {
    await cancelResponseBody(response);
    return { ok: false, reason: "content_length", bytesRead: 0, contentLength };
  }

  if (!response.body) {
    return { ok: true, bytes: new Uint8Array(), bytesRead: 0 };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytesRead = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      if (bytesRead + value.byteLength > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: "stream_limit", bytesRead, contentLength };
      }

      chunks.push(value);
      bytesRead += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(bytesRead);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    ok: true,
    bytes: combined,
    bytesRead,
  };
}

export async function readResponseBodyWithByteLimit(
  response: Response,
  options: { maxBytes: number },
): Promise<ReadResponseBodyResult> {
  const result = await readResponseBytesWithByteLimit(response, options);
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    body: new TextDecoder("utf-8", { fatal: false }).decode(result.bytes),
    bytesRead: result.bytesRead,
  };
}

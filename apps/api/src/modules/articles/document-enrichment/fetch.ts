import { fetchWithSafeRedirects } from "@shared/net/fetch";
import { assertHttpOrHttpsUrl } from "@shared/net/http";
import { BlockedOutboundUrlError } from "@shared/net/outbound";
import { cancelResponseBody } from "@kyomi/worker/lib/response-body";

export const ENRICHMENT_USER_AGENT =
  "Mozilla/5.0 (compatible; KyomiEnrichment/1.0; +https://kyomi.app)";

export type FetchOutcome<T> =
  | { ok: true; value: T }
  /** `retryable` failures (network, timeout, 429, 5xx) are worth another attempt. */
  | { ok: false; retryable: boolean; reason: string };

export type BoundedFetchOptions = {
  accept: string;
  timeoutMs: number;
  maxBytes: number;
  signal?: AbortSignal;
  /**
   * Called with the bytes read so far after every chunk; returning true ends the read early.
   * Used to stop an image download once its header has yielded the dimensions.
   */
  until?: (bytes: Uint8Array) => boolean;
  /** Reject responses whose content type does not match. */
  contentType?: RegExp;
};

function classifyStatus(status: number): FetchOutcome<never> {
  return {
    ok: false,
    retryable: status === 429 || status >= 500,
    reason: `status_${status}`,
  };
}

/**
 * GET through the SSRF-safe redirect fetcher with a time and size bound. Private, loopback, and
 * metadata addresses are rejected on the initial URL and on every redirect hop.
 */
export async function fetchBounded(
  rawUrl: string,
  options: BoundedFetchOptions,
): Promise<FetchOutcome<{ bytes: Uint8Array; contentType: string; truncated: boolean }>> {
  let url: URL;
  try {
    url = assertHttpOrHttpsUrl(rawUrl);
  } catch {
    return { ok: false, retryable: false, reason: "invalid_url" };
  }

  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(options.timeoutMs)])
    : AbortSignal.timeout(options.timeoutMs);

  try {
    const { response } = await fetchWithSafeRedirects(
      url,
      {
        headers: { accept: options.accept, "user-agent": ENRICHMENT_USER_AGENT },
        signal,
      },
      { maxRedirects: 4 },
    );
    if (!response.ok) {
      await cancelResponseBody(response);
      return classifyStatus(response.status);
    }
    const contentType =
      response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
    if (options.contentType && !options.contentType.test(contentType)) {
      await cancelResponseBody(response);
      return { ok: false, retryable: false, reason: "unexpected_content_type" };
    }
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > options.maxBytes && !options.until) {
      await cancelResponseBody(response);
      return { ok: false, retryable: false, reason: "too_large" };
    }
    if (!response.body) {
      return { ok: true, value: { bytes: new Uint8Array(), contentType, truncated: false } };
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    let truncated = false;
    let joined: Uint8Array = new Uint8Array();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > options.maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, retryable: false, reason: "too_large" };
      }
      chunks.push(value);
      if (options.until) {
        joined = concat(chunks, total);
        if (options.until(joined)) {
          truncated = true;
          await reader.cancel().catch(() => undefined);
          return { ok: true, value: { bytes: joined, contentType, truncated } };
        }
      }
    }
    return { ok: true, value: { bytes: concat(chunks, total), contentType, truncated } };
  } catch (error) {
    if (error instanceof BlockedOutboundUrlError) {
      return { ok: false, retryable: false, reason: "blocked_url" };
    }
    return {
      ok: false,
      retryable: true,
      reason: error instanceof Error ? error.name : "network_error",
    };
  }
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  if (chunks.length === 1) return chunks[0]!;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

import {
  cancelResponseBody,
  readResponseBytesWithByteLimit,
} from "@kyomi/worker/lib/response-body";
import { assertHttpOrHttpsUrl } from "@shared/net/http-url";
import { fetchWithSafeRedirects } from "@shared/net/safe-fetch";

const READER_IMAGE_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24;
const READER_IMAGE_CACHE_STALE_SECONDS = 60 * 60 * 24 * 7;
const READER_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const READER_IMAGE_TIMEOUT_MS = 8_000;

function imageHitHeaders(contentType: string) {
  return {
    "Cache-Control": `public, max-age=${READER_IMAGE_CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${READER_IMAGE_CACHE_STALE_SECONDS}`,
    "Content-Type": contentType,
  };
}

function isDisplayableImage(response: Response): string | null {
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (!contentType?.startsWith("image/")) {
    return null;
  }
  return contentType;
}

function imageMiss(status: 400 | 404 = 404) {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "public, max-age=120, stale-while-revalidate=600",
    },
  });
}

/**
 * Serves a bounded, SSRF-protected remote image for the Expo DOM reader.
 * The public publisher URL remains the source of truth; no image content is persisted here.
 */
export async function handleReaderImageRequest(request: Request): Promise<Response> {
  const rawUrl = new URL(request.url).searchParams.get("url");
  if (!rawUrl) {
    return imageMiss(400);
  }

  let sourceUrl: URL;
  try {
    sourceUrl = assertHttpOrHttpsUrl(rawUrl);
  } catch {
    return imageMiss(400);
  }

  try {
    const { response } = await fetchWithSafeRedirects(
      sourceUrl,
      {
        // Prefer formats that work across the Expo DOM WebView fleet. Some CDNs serve
        // AVIF only when it is explicitly requested, even when the source is a JPEG.
        headers: { Accept: "image/jpeg,image/png,image/webp,image/gif,image/*;q=0.8,*/*;q=0.5" },
        signal: AbortSignal.timeout(READER_IMAGE_TIMEOUT_MS),
      },
      { maxRedirects: 5 },
    );
    if (!response.ok) {
      await cancelResponseBody(response);
      return imageMiss();
    }

    const contentType = isDisplayableImage(response);
    if (!contentType) {
      await cancelResponseBody(response);
      return imageMiss();
    }

    const body = await readResponseBytesWithByteLimit(response, {
      maxBytes: READER_IMAGE_MAX_BYTES,
    });
    if (!body.ok) {
      return imageMiss();
    }

    const payload = new ArrayBuffer(body.bytes.byteLength);
    new Uint8Array(payload).set(body.bytes);
    return new Response(payload, {
      status: 200,
      headers: imageHitHeaders(contentType),
    });
  } catch {
    // Do not expose upstream URL, DNS, or network failures to the reader document.
    return imageMiss();
  }
}

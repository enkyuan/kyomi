import { assertHttpOrHttpsUrl } from "./http-url";
import { assertSafeOutboundUrl } from "./outbound-policy";

export class TooManyRedirectsError extends Error {
  constructor(message = "Too many redirects") {
    super(message);
    this.name = "TooManyRedirectsError";
  }
}

export function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

export async function fetchWithSafeRedirects(
  initialUrl: URL,
  init: RequestInit & { tls?: { rejectUnauthorized: boolean } },
  options?: { maxRedirects?: number },
): Promise<{ response: Response; finalUrl: URL }> {
  let currentUrl = initialUrl;
  const maxRedirects = options?.maxRedirects ?? 5;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await assertSafeOutboundUrl(currentUrl);
    const response = await fetch(currentUrl.href, {
      ...init,
      redirect: "manual",
    });

    if (!isRedirectStatus(response.status)) {
      return { response, finalUrl: currentUrl };
    }

    const location = response.headers.get("location");
    if (!location) {
      return { response, finalUrl: currentUrl };
    }

    if (redirectCount === maxRedirects) {
      response.body?.cancel().catch(() => undefined);
      throw new TooManyRedirectsError();
    }

    try {
      currentUrl = assertHttpOrHttpsUrl(new URL(location, currentUrl).href);
    } finally {
      response.body?.cancel().catch(() => undefined);
    }
  }

  throw new TooManyRedirectsError();
}

export async function readResponseBodyWithByteLimit(
  response: Response,
  maxBytes: number,
): Promise<{ ok: true; body: string } | { ok: false }> {
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) {
    return { ok: false };
  }
  return { ok: true, body: new TextDecoder("utf-8", { fatal: false }).decode(buffer) };
}

export function fetchMobile(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return globalThis.fetch(input, init);
}

export function prefetchMobile(_input: RequestInfo | URL, _init?: RequestInit): Promise<void> {
  return Promise.resolve();
}

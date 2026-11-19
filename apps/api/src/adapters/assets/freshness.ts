/** Respect the shortest origin or application lifetime across shared and private caches.
 * A fixed upstream representation is fetched without credentials. Unknown Vary values bypass storage. */
export function assetLifetime(headers: Pick<Headers, "get">, ttl: number, now = Date.now()) {
  const control = headers.get("cache-control") ?? "";
  const vary = (headers.get("vary") ?? "")
    .toLowerCase()
    .split(",")
    .map((value) => value.trim());
  if (
    vary.some((field) => field && !["accept", "accept-encoding"].includes(field)) ||
    headers.get("set-cookie") ||
    /(?:^|,)\s*(?:no-cache|private|no-store)(?:\s*[,=]|\s*$)/i.test(control)
  )
    return 0;
  const age = Math.max(0, Number(headers.get("age") ?? 0)) || 0;
  const dated = Date.parse(headers.get("date") ?? "");
  const elapsed = Math.max(age, Number.isFinite(dated) ? (now - dated) / 1000 : 0);
  const values = [...control.matchAll(/(?:^|,)\s*(?:max-age|s-maxage)\s*=\s*"?(\d+)/gi)].map(
    (match) => Number(match[1]),
  );
  const expires = Date.parse(headers.get("expires") ?? "");
  if (!values.length && Number.isFinite(expires))
    values.push((expires - (Number.isFinite(dated) ? dated : now)) / 1000);
  return Math.max(0, Math.floor(Math.min(ttl, ...values) - elapsed));
}

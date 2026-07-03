type HeaderBag = Headers | Record<string, string | string[] | undefined> | null | undefined;

type AuthContextLike =
  | {
      headers?: HeaderBag;
      request?: {
        headers?: HeaderBag;
      };
    }
  | null
  | undefined;

export type LocationFields = {
  locationCity: string | null;
  locationCountry: string | null;
  locationLabel: string | null;
  locationRegion: string | null;
};

function normalizeHeaderValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.toLowerCase() === "unknown") {
    return null;
  }

  return trimmed;
}

function readHeader(headers: HeaderBag, name: string) {
  if (!headers) {
    return null;
  }

  if (headers instanceof Headers) {
    return normalizeHeaderValue(headers.get(name));
  }

  const raw = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  if (Array.isArray(raw)) {
    return normalizeHeaderValue(raw[0]);
  }

  return typeof raw === "string" ? normalizeHeaderValue(raw) : null;
}

function getRequestHeaders(context: AuthContextLike): HeaderBag {
  return context?.headers ?? context?.request?.headers;
}

function isLoopbackAddress(ipAddress: string) {
  const normalized = ipAddress.trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "::ffff:127.0.0.1";
}

function isPrivateIpv4Address(ipAddress: string) {
  const match = ipAddress.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const normalized = match?.[1] ?? ipAddress;
  const octets = normalized.split(".");

  if (octets.length !== 4) {
    return false;
  }

  const [a, b] = octets.map((value) => Number.parseInt(value, 10));
  if ([a, b].some((value) => Number.isNaN(value))) {
    return false;
  }

  return (
    a === 10 ||
    a === 127 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

function isPrivateIpv6Address(ipAddress: string) {
  const normalized = ipAddress.trim().toLowerCase();
  return (
    normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:")
  );
}

function classifyIpAddress(ipAddress: string | null | undefined) {
  if (!ipAddress) {
    return null;
  }

  if (isLoopbackAddress(ipAddress)) {
    return "Localhost";
  }

  if (isPrivateIpv4Address(ipAddress) || isPrivateIpv6Address(ipAddress)) {
    return "Private network";
  }

  return null;
}

function buildLocationLabel(location: Omit<LocationFields, "locationLabel">) {
  if (location.locationCity && location.locationRegion) {
    return `${location.locationCity}, ${location.locationRegion}`;
  }

  if (location.locationCity && location.locationCountry) {
    return `${location.locationCity}, ${location.locationCountry}`;
  }

  if (location.locationRegion && location.locationCountry) {
    return `${location.locationRegion}, ${location.locationCountry}`;
  }

  return location.locationCity ?? location.locationRegion ?? location.locationCountry;
}

export function resolveLocationFromHeaders(
  headers: HeaderBag,
  ipAddress?: string | null,
): LocationFields {
  const locationCity =
    readHeader(headers, "cf-ipcity") ??
    readHeader(headers, "x-vercel-ip-city") ??
    readHeader(headers, "x-geo-city");
  const locationRegion =
    readHeader(headers, "cf-region") ??
    readHeader(headers, "x-vercel-ip-country-region") ??
    readHeader(headers, "x-geo-region");
  const locationCountry =
    readHeader(headers, "cf-ipcountry") ??
    readHeader(headers, "x-vercel-ip-country") ??
    readHeader(headers, "x-geo-country");
  const locationLabel =
    buildLocationLabel({ locationCity, locationCountry, locationRegion }) ??
    classifyIpAddress(ipAddress);

  return {
    locationCity,
    locationCountry,
    locationLabel,
    locationRegion,
  };
}

export function resolveLocationFromAuthContext(
  context: AuthContextLike,
  ipAddress?: string | null,
) {
  return resolveLocationFromHeaders(getRequestHeaders(context), ipAddress);
}

export function hydrateStoredLocation<
  T extends { ipAddress?: string | null } & Partial<LocationFields>,
>(session: T): T & LocationFields {
  const locationCity = normalizeHeaderValue(session.locationCity ?? null);
  const locationRegion = normalizeHeaderValue(session.locationRegion ?? null);
  const locationCountry = normalizeHeaderValue(session.locationCountry ?? null);
  const locationLabel =
    normalizeHeaderValue(session.locationLabel ?? null) ??
    buildLocationLabel({ locationCity, locationCountry, locationRegion }) ??
    classifyIpAddress(session.ipAddress);

  return {
    ...session,
    locationCity,
    locationCountry,
    locationLabel,
    locationRegion,
  };
}

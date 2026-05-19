export type SessionRow = {
  expiresAt: string;
  id: string;
  ipAddress: string | null;
  isCurrent: boolean;
  updatedAt: string;
  userAgent: string | null;
};

function parseSessionRow(value: unknown): SessionRow | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  const userAgent = typeof record.userAgent === "string" ? record.userAgent : null;
  const ipAddress = typeof record.ipAddress === "string" ? record.ipAddress : null;
  const updatedAt = typeof record.updatedAt === "string" ? record.updatedAt : "";
  const expiresAt = typeof record.expiresAt === "string" ? record.expiresAt : "";

  if (!id || !updatedAt || !expiresAt) {
    return null;
  }

  return {
    id,
    userAgent,
    ipAddress,
    updatedAt,
    expiresAt,
    isCurrent: false,
  };
}

export function parseSessionsResponse(value: unknown): SessionRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const sessions: SessionRow[] = [];

  for (const item of value) {
    const row = parseSessionRow(item);
    if (row) {
      sessions.push(row);
    }
  }

  return sessions;
}

const accountTimestampFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return accountTimestampFormatter.format(date);
}

export function shortenUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const normalized = userAgent.trim();
  if (!normalized) return "Unknown device";
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

export function normalizeTimestamp(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

export function parseApiErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message) as { error?: { message?: string } };
      if (parsed?.error?.message) {
        return parsed.error.message;
      }
    } catch {
      // Fallback to raw error message.
    }
    return error.message || "Unable to update email.";
  }
  return "Unable to update email.";
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

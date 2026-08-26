const MAX_LOG_MESSAGE_LENGTH = 320;
const MAX_USER_MESSAGE_LENGTH = 180;

const UNSAFE_CLIENT_ERROR_PATTERNS = [
  /^api errors?$/i,
  /^api errors?[:.]/i,
  /^\[api\]/i,
  /^request failed(?:[:.]|$)/i,
  /^failed to fetch/i,
  /^load failed$/i,
  /^networkerror\b/i,
  /^http \d{3}\b/i,
  /^\d{3}\b/,
  /^internal server error$/i,
  /^unexpected (?:end of json|token)/i,
  /^missing required api_origin$/i,
];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function compactLogMessage(value: string, maxLength = MAX_LOG_MESSAGE_LENGTH) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function getRecordString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function extractErrorMessageFromJson(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const directMessage = getRecordString(record, "message");
  if (directMessage) {
    return directMessage;
  }

  const error = record.error;
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  if (error && typeof error === "object") {
    const errorRecord = error as Record<string, unknown>;
    return (
      getRecordString(errorRecord, "message") ??
      getRecordString(errorRecord, "code") ??
      getRecordString(errorRecord, "status")
    );
  }

  return getRecordString(record, "statusText") ?? getRecordString(record, "code");
}

export function extractErrorMessageFromBody(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return extractErrorMessageFromJson(parsed) ?? compactLogMessage(trimmed);
  } catch {
    return compactLogMessage(trimmed);
  }
}

export async function readResponseErrorSummary(response: Response): Promise<string> {
  try {
    const body = await response.text();
    return (extractErrorMessageFromBody(body) ?? response.statusText) || "No response body";
  } catch (error) {
    return `Unable to read response body (${formatErrorForLog(error)})`;
  }
}

export function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message.trim() || null;
  }
  if (typeof error === "string") {
    return error.trim() || null;
  }
  if (error && typeof error === "object") {
    const message = getRecordString(error as Record<string, unknown>, "message");
    if (message) {
      return message;
    }
  }
  return null;
}

export function isClientUnsafeErrorMessage(message: string) {
  const compact = compactLogMessage(message, MAX_USER_MESSAGE_LENGTH);
  if (!compact) {
    return true;
  }
  if (compact.startsWith("{") || compact.startsWith("<")) {
    return true;
  }
  return UNSAFE_CLIENT_ERROR_PATTERNS.some((pattern) => pattern.test(compact));
}

export function getUserSafeErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Try again.",
) {
  const rawMessage = getErrorMessage(error);
  if (!rawMessage) {
    return fallback;
  }

  const message = extractErrorMessageFromBody(rawMessage) ?? rawMessage;
  if (isClientUnsafeErrorMessage(message)) {
    return fallback;
  }

  return compactLogMessage(message, MAX_USER_MESSAGE_LENGTH);
}

export function formatErrorForLog(error: unknown) {
  const message = getErrorMessage(error);
  if (message) {
    const extracted = extractErrorMessageFromBody(message) ?? message;
    const compact = compactLogMessage(extracted);
    if (error instanceof Error && error.name && error.name !== "Error") {
      return `${error.name}: ${compact}`;
    }
    return compact;
  }

  try {
    return compactLogMessage(JSON.stringify(error));
  } catch {
    return String(error);
  }
}

export function logClientError(scope: string, error: unknown) {
  console.error(`[${scope}] ${formatErrorForLog(error)}`);
}

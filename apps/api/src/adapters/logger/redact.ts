const SENSITIVE_KEY = /password|secret|token|authorization|cookie|set-cookie/i;

/**
 * Shallow clone with sensitive-looking keys redacted for structured logs.
 */
export function redactForLog(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = "[redacted]";
    } else {
      out[key] = value;
    }
  }
  return out;
}

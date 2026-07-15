const REDACTED_KEYS = /token|secret|password|authorization|cookie|bank|account_number|payment_reference|external_transaction|body|message|source_url|stream_url/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitize(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !REDACTED_KEYS.test(key))
        .map(([key, item]) => [key, sanitize(item, depth + 1)]),
    );
  }
  if (typeof value === "string") return value.slice(0, 500);
  return value;
}

export function operationalLog(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown> = {},
) {
  const safeFields = sanitize(fields) as Record<string, unknown>;
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...safeFields,
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

/**
 * Parse newline-delimited JSON from a CLI stdout stream.
 */
export async function* parseNdjsonLines(
  lines: AsyncIterable<string>,
): AsyncGenerator<Record<string, unknown>> {
  for await (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const value = JSON.parse(trimmed) as unknown;
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        yield value as Record<string, unknown>;
      }
    } catch {
      // Skip malformed lines (progress noise, etc.)
    }
  }
}

export function getStringField(
  obj: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = obj[key];
  return typeof value === "string" ? value : undefined;
}

export function getNestedText(
  obj: Record<string, unknown>,
  path: string[],
): string | undefined {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : undefined;
}

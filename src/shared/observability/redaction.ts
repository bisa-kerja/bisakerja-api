const sensitiveKeyPattern =
  /password|token|otp|secret|authorization|cookie|credential|apiKey|cvContent|rawCv|rawPayload|rawModel|rawScraper|databaseUrl|DATABASE_URL|RESEND_API_KEY/i;

export function sanitizeSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSensitiveValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        sensitiveKeyPattern.test(key)
          ? "[REDACTED]"
          : sanitizeSensitiveValue(entry)
      ])
    );
  }

  return value;
}

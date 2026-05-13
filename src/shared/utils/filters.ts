export function serializeProvidedFilters(filters: Record<string, unknown>) {
  return Object.entries(filters).reduce<Record<string, unknown>>(
    (serialized, [key, value]) => {
      if (value !== undefined) {
        serialized[key] = value;
      }

      return serialized;
    },
    {}
  );
}

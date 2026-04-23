const durationPattern = /^(\d+)(ms|s|m|h|d)$/;

const durationToMs = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000
} as const;

export function parseDurationMs(value: string): number {
  const match = durationPattern.exec(value.trim());

  if (!match) {
    throw new Error(`Invalid duration value: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2] as keyof typeof durationToMs;

  return amount * durationToMs[unit];
}

export function parseDurationSeconds(value: string): number {
  return Math.floor(parseDurationMs(value) / 1000);
}

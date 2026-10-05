/** Seconds left given progress samples; null until there is enough signal. */
export function estimateSecondsLeft(input: {
  /** Fraction complete now, 0-1. */
  fraction: number;
  /** Fraction complete at the first sample. */
  startFraction: number;
  /** Milliseconds between the first sample and now. */
  elapsedMs: number;
}): number | null {
  const gained = input.fraction - input.startFraction;
  if (input.fraction >= 1) return 0;
  if (gained <= 0 || input.elapsedMs < 3000) return null;
  const perMs = gained / input.elapsedMs;
  return Math.max(0, Math.round((1 - input.fraction) / perMs / 1000));
}

export function formatSecondsLeft(seconds: number | null): string | null {
  if (seconds == null) return null;
  if (seconds < 10) return 'a few seconds left';
  if (seconds < 60) return `about ${Math.round(seconds / 5) * 5}s left`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `about ${minutes} min left`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `about ${h}h left` : `about ${h}h ${m}m left`;
}
